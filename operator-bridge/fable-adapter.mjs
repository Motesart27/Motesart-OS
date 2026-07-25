import { BLOCKER_CODES } from './constants.mjs'

export class FableAdapter {
  constructor({ callable = null } = {}) {
    this.callable = callable
  }

  async review(request) {
    if (!this.callable) {
      return {
        ok: false,
        status: 'BLOCKED',
        blocker_code: BLOCKER_CODES.ADAPTER_UNAVAILABLE,
        resumable: true,
        next_action: 'RESUME_WHEN_AUTHORIZED_FABLE_ADAPTER_IS_AVAILABLE',
        work_order_id: request.work_order_id,
      }
    }
    return this.callable(request)
  }
}
