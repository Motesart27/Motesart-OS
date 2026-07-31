export const WORK_ORDER_STATES = Object.freeze([
  'DRAFT',
  'NEEDS_APPROVAL',
  'QUEUED',
  'CLAIMED',
  'RUNNING',
  'VERIFYING',
  'READY_FOR_APPROVAL',
  'COMPLETED',
  'BLOCKED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
])

export const TERMINAL_STATES = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED'])

export const TRANSITIONS = Object.freeze({
  DRAFT: new Set(['NEEDS_APPROVAL', 'QUEUED', 'CANCELLED']),
  NEEDS_APPROVAL: new Set(['QUEUED', 'CANCELLED']),
  QUEUED: new Set(['CLAIMED', 'BLOCKED', 'CANCELLED', 'EXPIRED']),
  CLAIMED: new Set(['RUNNING', 'QUEUED', 'BLOCKED', 'FAILED', 'CANCELLED', 'EXPIRED']),
  RUNNING: new Set(['VERIFYING', 'QUEUED', 'BLOCKED', 'FAILED', 'CANCELLED', 'EXPIRED']),
  VERIFYING: new Set(['READY_FOR_APPROVAL', 'COMPLETED', 'BLOCKED', 'FAILED', 'CANCELLED']),
  READY_FOR_APPROVAL: new Set(['COMPLETED', 'QUEUED', 'BLOCKED', 'CANCELLED']),
  COMPLETED: new Set(),
  BLOCKED: new Set(['QUEUED', 'FAILED', 'CANCELLED', 'EXPIRED']),
  FAILED: new Set(),
  CANCELLED: new Set(),
  EXPIRED: new Set(),
})

export const EXECUTOR_ACTIONS = Object.freeze([
  'health',
  'claim_work_order',
  'heartbeat',
  'collect_github_read_only',
  'invoke_kimi_analysis',
  'run_local_tests',
  'package_artifacts',
  'return_result',
  'release_or_block_work_order',
])

export const BLOCKER_CODES = Object.freeze({
  WAITING_FOR_ORCA: 'WAITING_FOR_ORCA',
  ADAPTER_UNAVAILABLE: 'BLOCKED_ADAPTER_UNAVAILABLE',
  LEASE_EXPIRED: 'LEASE_EXPIRED',
  KIMI_TIMEOUT_BEFORE_FIRST_TOKEN: 'KIMI_TIMEOUT_BEFORE_FIRST_TOKEN',
  KIMI_TIMEOUT_PARTIAL: 'KIMI_TIMEOUT_PARTIAL',
  ARTIFACT_INTEGRITY_FAILURE: 'ARTIFACT_INTEGRITY_FAILURE',
})

export const APPROVAL_CLASSES = Object.freeze({
  READ_ONLY: 'READ_ONLY',
  LOCAL_WRITE: 'LOCAL_WRITE',
  PROTECTED_WRITE: 'PROTECTED_WRITE',
  CRITICAL: 'CRITICAL',
})

export const ARTIFACT_TYPES = Object.freeze([
  'prompt',
  'source_snapshot',
  'diff',
  'model_response',
  'model_response_partial',
  'test_log',
  'evidence_report',
  'zip_package',
  'decision_card',
  'repository_identity',
  'pull_request_identity',
  'workflow_status',
  'commit_history',
  'verifier_identity',
  'verifier_qualification',
  'verifier_verdict',
])
