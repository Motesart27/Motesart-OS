export const STAGING_API_URL = 'https://operator-bridge-control-plane-staging.up.railway.app'
export const STAGING_PREVIEW_HOST = 'deploy-preview-22--motesart-os.netlify.app'
export const STAGING_BANNER = 'SUPERVISED STAGING — NOT PRODUCTION'

export class StagingClient {
  constructor({ buildHead }) {
    this.buildHead = buildHead
    this.token = null
  }

  async request(path, { method = 'GET', body = null, authenticated = true } = {}) {
    const headers = {
      'x-motesart-preview-head': this.buildHead,
    }
    if (body) headers['content-type'] = 'application/json'
    if (authenticated && this.token) headers.authorization = `Bearer ${this.token}`
    const response = await fetch(`${STAGING_API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const payload = await response.json().catch(() => ({ error: { code: 'STAGING_RESPONSE_UNAVAILABLE' } }))
    if (!response.ok) {
      const error = new Error(payload.error?.message ?? 'STAGING_SERVICE_UNAVAILABLE')
      error.code = payload.error?.code ?? 'STAGING_SERVICE_UNAVAILABLE'
      throw error
    }
    return payload
  }

  async login(ownerId, password) {
    const result = await this.request('/v1/auth/session', { method: 'POST', authenticated: false, body: { owner_id: ownerId, password } })
    this.token = result.token
    return result
  }

  logout() {
    this.token = null
  }

  list() {
    return this.request('/v1/work-orders')
  }

  submit(body) {
    return this.request('/v1/work-orders', { method: 'POST', body })
  }

  manualRetry(id, idempotencyKey) {
    return this.request(`/v1/work-orders/${encodeURIComponent(id)}/manual-retry`, {
      method: 'POST',
      body: { idempotency_key: idempotencyKey },
    })
  }

  detail(id) {
    return Promise.all([
      this.request(`/v1/work-orders/${encodeURIComponent(id)}`),
      this.request(`/v1/work-orders/${encodeURIComponent(id)}/events`),
      this.request(`/v1/work-orders/${encodeURIComponent(id)}/artifacts`),
      this.request(`/v1/work-orders/${encodeURIComponent(id)}/decision-card`).catch((error) => error.code === 'DECISION_CARD_NOT_AVAILABLE' ? { decision_card: null } : Promise.reject(error)),
    ])
  }
}
