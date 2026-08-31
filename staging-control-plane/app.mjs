import { createServer } from 'node:http'

import { constantTimeEqual, sha256, signToken, verifyPassword, verifyToken } from './security.mjs'
import { StagingStoreError } from './store.mjs'

export const STAGING_BANNER = 'SUPERVISED STAGING — NOT PRODUCTION'
const FORBIDDEN_FIELDS = new Set(['shell', 'script', 'executable', 'argv', 'command', 'remote_command', 'remoteCommand', 'process'])
const OWNER_BODY_FIELDS = new Set(['owner_id', 'password'])
const WORK_ORDER_FIELDS = new Set(['instruction', 'originating_surface', 'task_type', 'scope', 'priority', 'approval_class', 'executor', 'idempotency_key'])
const ARTIFACT_FIELDS = new Set(['artifact_type', 'content_base64', 'sha256', 'byte_count', 'sensitivity_classification'])
const COMPLETE_FIELDS = new Set(['result_artifact_id', 'evidence_artifact_id', 'decision_card_artifact_id'])
const ORCA_ACTION_SCOPES = Object.freeze({ heartbeat: 'heartbeat', artifacts: 'artifact:return', complete: 'complete', block: 'block', release: 'release' })
const MANUAL_RETRY_FIELDS = new Set(['idempotency_key'])

export class StagingApiError extends Error {
  constructor(code, status = 400) {
    super(code)
    this.name = 'StagingApiError'
    this.code = code
    this.status = status
  }
}

// Proxy-aware client identity. Forwarded headers are honored only when the
// direct peer is an explicitly configured trusted proxy; the rightmost
// X-Forwarded-For hop is used because that is the value the trusted proxy
// itself appended (anything to its left may be client-spoofed). Without a
// trusted peer the socket address is always the fallback.
export function clientIdentity(request, trustedProxyIps) {
  const socketAddress = request.socket.remoteAddress ?? 'unknown'
  if (!Array.isArray(trustedProxyIps) || !trustedProxyIps.includes(socketAddress)) return socketAddress
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded !== 'string' || forwarded.length > 512) return socketAddress
  const hops = forwarded.split(',').map((hop) => hop.trim()).filter(Boolean)
  if (hops.length === 0) return socketAddress
  return hops[hops.length - 1]
}

// Bounded login throttle: per-identity buckets with expiry sweep on every
// insert, a hard cap on bucket count, and fail-closed rejection when full.
export function createLoginThrottle({ now = () => Date.now(), limit = 5, windowMs = 60_000, maxBuckets = 1024 } = {}) {
  const buckets = new Map()
  return function throttle(identityKey) {
    const current = now()
    for (const [key, record] of buckets) {
      if (record.resetAt <= current) buckets.delete(key)
    }
    if (!buckets.has(identityKey) && buckets.size >= maxBuckets) throw new StagingApiError('AUTH_RATE_LIMITED', 429)
    const record = buckets.get(identityKey) ?? { count: 0, resetAt: current + windowMs }
    if (record.count >= limit) throw new StagingApiError('AUTH_RATE_LIMITED', 429)
    record.count += 1
    buckets.set(identityKey, record)
  }
}

function exactFields(object, allowed) {
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new StagingApiError('INVALID_REQUEST_BODY')
  const unexpected = Object.keys(object).filter((key) => !allowed.has(key))
  if (unexpected.length) throw new StagingApiError('EXTRA_FIELDS_FORBIDDEN')
}

function rejectForbidden(value) {
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.has(key)) throw new StagingApiError('ARBITRARY_EXECUTION_FIELD_REJECTED')
    rejectForbidden(nested)
  }
}

function bearer(request) {
  const value = request.headers.authorization ?? ''
  const match = value.match(/^Bearer ([A-Za-z0-9._~-]+)$/)
  if (!match) throw new StagingApiError('AUTHENTICATION_REQUIRED', 401)
  return match[1]
}

async function bodyJson(request, maxBytes = 1_500_000) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) throw new StagingApiError('REQUEST_TOO_LARGE', 413)
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new StagingApiError('INVALID_JSON')
  }
}

function responseBody(payload) {
  return { banner: STAGING_BANNER, mode: 'supervised_staging', ...payload }
}

function send(response, status, payload, origin = null) {
  const content = JSON.stringify(responseBody(payload))
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(content),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'x-motesart-staging': 'true',
  }
  if (origin) {
    headers['access-control-allow-origin'] = origin
    headers.vary = 'Origin'
  }
  response.writeHead(status, headers)
  response.end(content)
}

function validateWorkOrder(input) {
  exactFields(input, WORK_ORDER_FIELDS)
  rejectForbidden(input)
  if (typeof input.instruction !== 'string' || input.instruction.trim().length < 1 || input.instruction.length > 12_000) throw new StagingApiError('INVALID_INSTRUCTION')
  if (input.originating_surface !== 'motesart-os-netlify-preview') throw new StagingApiError('INVALID_ORIGINATING_SURFACE')
  if (!['staging_smoke_test', 'github_pr_read_only_review', 'architecture_review'].includes(input.task_type)) throw new StagingApiError('INVALID_TASK_TYPE')
  if (!input.scope || typeof input.scope !== 'object' || Array.isArray(input.scope) || JSON.stringify(input.scope).length > 16_000) throw new StagingApiError('INVALID_SCOPE')
  if (!['low', 'normal', 'high'].includes(input.priority)) throw new StagingApiError('INVALID_PRIORITY')
  if (input.approval_class !== 'READ_ONLY') throw new StagingApiError('PROTECTED_WRITE_DISABLED', 403)
  if (!['ORCA', 'AUTO_ROUTE'].includes(input.executor)) throw new StagingApiError('INVALID_EXECUTOR')
  if (!/^[A-Za-z0-9._:-]{8,180}$/.test(input.idempotency_key ?? '')) throw new StagingApiError('INVALID_IDEMPOTENCY_KEY')
  return { ...input, instruction: input.instruction.trim(), requested_by: 'staging-owner' }
}

function validateArtifact(input) {
  exactFields(input, ARTIFACT_FIELDS)
  rejectForbidden(input)
  if (!['repository_identity', 'workflow_status', 'model_response', 'test_log', 'verifier_verdict', 'decision_card', 'evidence_report'].includes(input.artifact_type)) throw new StagingApiError('INVALID_ARTIFACT_TYPE')
  if (!/^[a-f0-9]{64}$/.test(input.sha256 ?? '') || !Number.isInteger(input.byte_count) || input.byte_count < 0 || input.byte_count > 1_000_000) throw new StagingApiError('INVALID_ARTIFACT_METADATA')
  if (typeof input.content_base64 !== 'string' || input.content_base64.length > 1_500_000) throw new StagingApiError('INVALID_ARTIFACT_CONTENT')
  if (!['public', 'synthetic', 'internal'].includes(input.sensitivity_classification)) throw new StagingApiError('INVALID_SENSITIVITY_CLASSIFICATION')
  return input
}

function safePath(url) {
  try {
    return new URL(url, 'http://staging.invalid').pathname
  } catch {
    throw new StagingApiError('INVALID_PATH', 404)
  }
}

export function createStagingApi({ store, config, logger = console }) {
  const throttleLogin = createLoginThrottle({ now: typeof config.now === 'function' ? () => config.now() : undefined })
  const audit = (event, metadata = {}) => logger.info?.(JSON.stringify({ event, ...metadata }))

  function requirePreview(request) {
    const origin = request.headers.origin
    if (origin !== config.allowedOrigin) throw new StagingApiError('STAGING_ORIGIN_FORBIDDEN', 403)
    if (request.headers['x-motesart-preview-head'] !== config.expectedPreviewHead) throw new StagingApiError('STALE_PREVIEW_HEAD', 409)
    return origin
  }

  function requireRole(request, role, requiredScope = null) {
    const token = bearer(request)
    try {
      return verifyToken(token, role === 'owner' ? config.sessionSigningKey : config.orcaSigningKey, {
        issuer: config.issuer,
        audience: role === 'owner' ? 'motesart-os-staging-preview' : 'operator-bridge-staging-orca',
        allowedRoles: [role],
        requiredScopes: requiredScope ? [requiredScope] : [],
      })
    } catch (error) {
      if (error.message === 'FORBIDDEN_ROLE' || error.message === 'INSUFFICIENT_SCOPE') throw new StagingApiError(error.message, 403)
      throw new StagingApiError(error.message === 'EXPIRED_TOKEN' ? 'SESSION_EXPIRED' : 'AUTHENTICATION_INVALID', 401)
    }
  }

  async function route(request, response) {
    const pathname = safePath(request.url)
    const origin = request.headers.origin === config.allowedOrigin ? config.allowedOrigin : null
    if (request.method === 'OPTIONS') {
      if (!origin) throw new StagingApiError('STAGING_ORIGIN_FORBIDDEN', 403)
      response.writeHead(204, {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'Authorization,Content-Type,X-Motesart-Preview-Head,X-Lease-Token',
        'access-control-max-age': '600',
        vary: 'Origin',
        'x-motesart-staging': 'true',
      })
      response.end()
      return
    }

    if (request.method === 'GET' && pathname === '/v1/health') {
      send(response, 200, { ok: true, service: 'mya-operator-bridge-control-plane', expected_preview_head: config.expectedPreviewHead, storage_namespace: 'staging', approvals_enabled: false }, origin)
      return
    }

    if (request.method === 'POST' && pathname === '/v1/auth/session') {
      const previewOrigin = requirePreview(request)
      const body = await bodyJson(request, 16_000)
      exactFields(body, OWNER_BODY_FIELDS)
      throttleLogin(`${clientIdentity(request, config.trustedProxyIps)}|${body.owner_id ?? ''}`)
      if (!constantTimeEqual(body.owner_id ?? '', config.ownerId) || !verifyPassword(body.password ?? '', config.ownerPasswordHash)) {
        audit('owner_session_rejected', { status: 401 })
        throw new StagingApiError('AUTHENTICATION_INVALID', 401)
      }
      const token = signToken({ sub: config.ownerId, role: 'owner', scopes: ['work-orders:submit', 'work-orders:read', 'work-orders:retry'] }, config.sessionSigningKey, {
        issuer: config.issuer,
        audience: 'motesart-os-staging-preview',
        ttlSeconds: config.ownerSessionTtlSeconds,
      })
      audit('owner_session_issued', { role: 'owner', ttl_seconds: config.ownerSessionTtlSeconds })
      send(response, 200, { token, expires_in_seconds: config.ownerSessionTtlSeconds, owner_id: config.ownerId }, previewOrigin)
      return
    }

    if (request.method === 'POST' && pathname === '/v1/executors/orca/session') {
      const bootstrap = bearer(request)
      if (!constantTimeEqual(sha256(bootstrap), config.orcaBootstrapTokenHash)) throw new StagingApiError('AUTHENTICATION_INVALID', 401)
      const body = await bodyJson(request, 4_000)
      exactFields(body, new Set(['worker_id']))
      if (!/^[A-Za-z0-9._:-]{3,120}$/.test(body.worker_id ?? '')) throw new StagingApiError('INVALID_WORKER_ID')
      const token = signToken({ sub: body.worker_id, role: 'orca', scopes: ['claim', 'heartbeat', 'artifact:return', 'complete', 'block', 'release'] }, config.orcaSigningKey, {
        issuer: config.issuer,
        audience: 'operator-bridge-staging-orca',
        ttlSeconds: config.orcaSessionTtlSeconds,
      })
      audit('orca_session_issued', { role: 'orca', worker_id: body.worker_id, ttl_seconds: config.orcaSessionTtlSeconds })
      send(response, 200, { token, expires_in_seconds: config.orcaSessionTtlSeconds, worker_id: body.worker_id })
      return
    }

    if (pathname.startsWith('/v1/work-orders')) {
      const previewOrigin = requirePreview(request)
      const ownerScope = request.method === 'POST' && pathname === '/v1/work-orders'
        ? 'work-orders:submit'
        : request.method === 'POST' && /^\/v1\/work-orders\/[A-Za-z0-9._:-]+\/manual-retry$/.test(pathname)
          ? 'work-orders:retry'
          : 'work-orders:read'
      const identity = requireRole(request, 'owner', ownerScope)
      if (request.method === 'POST' && pathname === '/v1/work-orders') {
        const body = validateWorkOrder(await bodyJson(request))
        const created = await store.createWorkOrder(body)
        audit('work_order_submitted', { work_order_id: created.work_order.work_order_id, duplicate: created.duplicate, status: created.work_order.status })
        send(response, created.duplicate ? 200 : 201, created, previewOrigin)
        return
      }
      if (request.method === 'GET' && pathname === '/v1/work-orders') {
        send(response, 200, { work_orders: await store.listWorkOrders() }, previewOrigin)
        return
      }
      const retryMatch = pathname.match(/^\/v1\/work-orders\/([A-Za-z0-9._:-]+)\/manual-retry$/)
      if (retryMatch && request.method === 'POST') {
        const body = await bodyJson(request, 4_000)
        exactFields(body, MANUAL_RETRY_FIELDS)
        if (!/^[A-Za-z0-9._:-]{8,180}$/.test(body.idempotency_key ?? '')) throw new StagingApiError('INVALID_IDEMPOTENCY_KEY')
        const result = await store.manualRetry(retryMatch[1], { actor: identity.sub, idempotencyKey: body.idempotency_key })
        audit('manual_retry_processed', {
          work_order_id: result.work_order.work_order_id,
          duplicate: result.duplicate,
          manual_retry_count: result.work_order.manual_retry_count,
          status: result.work_order.status,
        })
        send(response, 200, result, previewOrigin)
        return
      }
      const match = pathname.match(/^\/v1\/work-orders\/([A-Za-z0-9._:-]+)(?:\/(events|artifacts|decision-card))?$/)
      if (!match || request.method !== 'GET') throw new StagingApiError('ROUTE_NOT_FOUND', 404)
      if (!match[2]) send(response, 200, { work_order: await store.getWorkOrder(match[1]) }, previewOrigin)
      else if (match[2] === 'events') send(response, 200, { events: await store.getEvents(match[1]) }, previewOrigin)
      else if (match[2] === 'artifacts') send(response, 200, { artifacts: await store.getArtifacts(match[1]) }, previewOrigin)
      else send(response, 200, { decision_card: await store.getDecisionCard(match[1]) }, previewOrigin)
      return
    }

    if (request.method === 'POST' && pathname === '/v1/executors/orca/claim') {
      const identity = requireRole(request, 'orca', 'claim')
      const body = await bodyJson(request, 8_000)
      exactFields(body, new Set(['work_order_id', 'capabilities', 'lease_ttl_seconds']))
      if (!Array.isArray(body.capabilities) || body.capabilities.some((item) => typeof item !== 'string')) throw new StagingApiError('INVALID_CAPABILITIES')
      if (typeof body.work_order_id !== 'string' || !/^[A-Za-z0-9._:-]+$/.test(body.work_order_id)) throw new StagingApiError('CLAIM_TARGET_REQUIRED')
      const claim = await store.claim({ workOrderId: body.work_order_id, leaseOwner: identity.sub, leaseTtlMs: Math.min(Math.max(Number(body.lease_ttl_seconds ?? 60), 15), 300) * 1000 })
      send(response, 200, { claim })
      return
    }

    const orcaMatch = pathname.match(/^\/v1\/executors\/orca\/work-orders\/([A-Za-z0-9._:-]+)\/(heartbeat|artifacts|complete|block|release)$/)
    if (orcaMatch && request.method === 'POST') {
      const identity = requireRole(request, 'orca', ORCA_ACTION_SCOPES[orcaMatch[2]])
      const workOrderId = orcaMatch[1]
      const action = orcaMatch[2]
      const leaseToken = request.headers['x-lease-token']
      if (typeof leaseToken !== 'string') throw new StagingApiError('FENCING_TOKEN_REQUIRED', 401)
      if (action === 'heartbeat') {
        const body = await bodyJson(request, 4_000)
        exactFields(body, new Set(['lease_ttl_seconds']))
        const workOrder = await store.heartbeat(workOrderId, { leaseOwner: identity.sub, leaseToken, leaseTtlMs: Math.min(Math.max(Number(body.lease_ttl_seconds ?? 60), 15), 300) * 1000 })
        send(response, 200, { work_order: workOrder })
      } else if (action === 'artifacts') {
        const artifact = validateArtifact(await bodyJson(request))
        send(response, 201, { artifact: await store.uploadArtifact(workOrderId, { leaseOwner: identity.sub, leaseToken, artifact }) })
      } else if (action === 'complete') {
        const body = await bodyJson(request, 8_000)
        exactFields(body, COMPLETE_FIELDS)
        send(response, 200, { work_order: await store.complete(workOrderId, { leaseOwner: identity.sub, leaseToken, resultArtifactId: body.result_artifact_id, evidenceArtifactId: body.evidence_artifact_id, decisionCardArtifactId: body.decision_card_artifact_id }) })
      } else if (action === 'block') {
        const body = await bodyJson(request, 8_000)
        exactFields(body, new Set(['blocker_code', 'next_action']))
        if (!/^[A-Z0-9_]{3,120}$/.test(body.blocker_code ?? '') || typeof body.next_action !== 'string') throw new StagingApiError('INVALID_BLOCK_REQUEST')
        send(response, 200, { work_order: await store.block(workOrderId, { leaseOwner: identity.sub, leaseToken, blockerCode: body.blocker_code, nextAction: body.next_action }) })
      } else {
        const body = await bodyJson(request, 4_000)
        exactFields(body, new Set())
        send(response, 200, { work_order: await store.release(workOrderId, { leaseOwner: identity.sub, leaseToken }) })
      }
      audit('orca_action_completed', { action, work_order_id: workOrderId, worker_id: identity.sub })
      return
    }

    throw new StagingApiError('ROUTE_NOT_FOUND', 404)
  }

  const handler = async (request, response) => {
    try {
      await route(request, response)
    } catch (error) {
      const status = error instanceof StagingApiError || error instanceof StagingStoreError ? error.status : 500
      const code = error instanceof StagingApiError || error instanceof StagingStoreError ? error.code : 'STAGING_SERVICE_UNAVAILABLE'
      audit('request_failed', { route: safePath(request.url), method: request.method, status, code, error_class: error.name })
      send(response, status, { ok: false, error: { code, message: code } }, request.headers.origin === config.allowedOrigin ? config.allowedOrigin : null)
    }
  }
  return { handler, server: createServer(handler) }
}
