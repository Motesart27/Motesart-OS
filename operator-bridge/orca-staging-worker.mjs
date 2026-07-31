import { sha256 } from '../staging-control-plane/security.mjs'

const ALLOWED_ACTIONS = new Set(['health', 'claim', 'heartbeat', 'upload_artifact', 'complete', 'block', 'release'])
const FORBIDDEN_FIELDS = new Set(['shell', 'script', 'executable', 'argv', 'command', 'remote_command', 'remoteCommand', 'process'])

export class OrcaStagingWorkerError extends Error {
  constructor(code, status = null) {
    super(code)
    this.name = 'OrcaStagingWorkerError'
    this.code = code
    this.status = status
  }
}

function rejectForbidden(value) {
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.has(key)) throw new OrcaStagingWorkerError('ARBITRARY_COMMAND_REJECTED')
    rejectForbidden(nested)
  }
}

export class OrcaStagingWorker {
  constructor({ baseUrl, workerId, bootstrapTokenProvider, fetchImpl = globalThis.fetch }) {
    if (!/^https:\/\/operator-bridge-control-plane-staging\.up\.railway\.app$/.test(baseUrl)) {
      throw new OrcaStagingWorkerError('STAGING_SERVICE_IDENTITY_INVALID')
    }
    this.baseUrl = baseUrl
    this.workerId = workerId
    this.bootstrapTokenProvider = bootstrapTokenProvider
    this.fetchImpl = fetchImpl
    this.sessionToken = null
  }

  async _request(path, { method = 'POST', body = null, token = this.sessionToken, leaseToken = null } = {}) {
    rejectForbidden(body)
    const headers = { 'content-type': 'application/json' }
    if (token) headers.authorization = `Bearer ${token}`
    if (leaseToken) headers['x-lease-token'] = leaseToken
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new OrcaStagingWorkerError(payload.error?.code ?? 'STAGING_SERVICE_UNAVAILABLE', response.status)
    return payload
  }

  async authenticate() {
    const bootstrapToken = await this.bootstrapTokenProvider()
    if (!bootstrapToken) throw new OrcaStagingWorkerError('ORCA_STAGING_CREDENTIAL_UNAVAILABLE')
    const payload = await this._request('/v1/executors/orca/session', {
      token: bootstrapToken,
      body: { worker_id: this.workerId },
    })
    this.sessionToken = payload.token
    return { worker_id: payload.worker_id, expires_in_seconds: payload.expires_in_seconds, banner: payload.banner }
  }

  async execute({ action, payload = {} }) {
    if (!ALLOWED_ACTIONS.has(action)) throw new OrcaStagingWorkerError('UNSUPPORTED_STAGING_ACTION')
    rejectForbidden(payload)
    if (action === 'health') return { ok: true, connection_model: 'OUTBOUND_ONLY', worker_id: this.workerId, typed_actions_only: true }
    if (!this.sessionToken) await this.authenticate()
    if (action === 'claim') return this._request('/v1/executors/orca/claim', { body: { capabilities: payload.capabilities ?? [], lease_ttl_seconds: payload.lease_ttl_seconds ?? 60 } })
    if (!payload.work_order_id || !payload.lease_token) throw new OrcaStagingWorkerError('WORK_ORDER_AND_LEASE_REQUIRED')
    const base = `/v1/executors/orca/work-orders/${encodeURIComponent(payload.work_order_id)}`
    if (action === 'heartbeat') return this._request(`${base}/heartbeat`, { body: { lease_ttl_seconds: payload.lease_ttl_seconds ?? 60 }, leaseToken: payload.lease_token })
    if (action === 'upload_artifact') {
      const content = Buffer.isBuffer(payload.content) ? payload.content : Buffer.from(String(payload.content ?? ''))
      return this._request(`${base}/artifacts`, {
        leaseToken: payload.lease_token,
        body: {
          artifact_type: payload.artifact_type,
          content_base64: content.toString('base64'),
          sha256: sha256(content),
          byte_count: content.length,
          sensitivity_classification: payload.sensitivity_classification ?? 'synthetic',
        },
      })
    }
    if (action === 'complete') return this._request(`${base}/complete`, { leaseToken: payload.lease_token, body: { result_artifact_id: payload.result_artifact_id, evidence_artifact_id: payload.evidence_artifact_id, decision_card_artifact_id: payload.decision_card_artifact_id } })
    if (action === 'block') return this._request(`${base}/block`, { leaseToken: payload.lease_token, body: { blocker_code: payload.blocker_code, next_action: payload.next_action } })
    return this._request(`${base}/release`, { leaseToken: payload.lease_token, body: {} })
  }
}
