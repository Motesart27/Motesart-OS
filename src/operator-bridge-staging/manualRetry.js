const RETRY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,180}$/

export function isManualRetryEligible(workOrder) {
  return workOrder?.manual_retry_eligible === true
}

export function createManualRetryIdempotencyKey(workOrderId, uuid = () => crypto.randomUUID()) {
  const key = `manual-retry:${workOrderId}:${uuid()}`
  if (!RETRY_KEY_PATTERN.test(key)) throw new TypeError('INVALID_MANUAL_RETRY_KEY')
  return key
}
