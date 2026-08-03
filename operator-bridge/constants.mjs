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
  ORDER_EXECUTION_TIMEOUT: 'ORDER_EXECUTION_TIMEOUT',
  ORDER_EXECUTION_FAILED: 'ORDER_EXECUTION_FAILED',
  SESSION_TIME_EXHAUSTED: 'SESSION_TIME_EXHAUSTED',
  WORKER_SHUTDOWN_RESUMABLE: 'BLOCKED_WORKER_SHUTDOWN_RESUMABLE',
  TASK_TYPE_NOT_ALLOWLISTED: 'TASK_TYPE_NOT_ALLOWLISTED',
  APPROVAL_CLASS_NOT_EXECUTABLE: 'APPROVAL_CLASS_NOT_EXECUTABLE',
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

// ---------------------------------------------------------------------------
// Bounded worker contract (fix/operator-bridge-bounded-worker-pilot)
// ---------------------------------------------------------------------------

// The only environment a bounded worker may execute against. Anything else
// (production, development, unspecified) is rejected before any work begins.
export const STAGING_ENVIRONMENT = 'staging'
export const WORKER_ENVIRONMENTS = Object.freeze([STAGING_ENVIRONMENT])

// Executor-side execution allowlist. A bounded worker claims and runs only
// work orders whose task_type and approval_class appear here. Protected
// approval classes are never executable by the worker.
export const DEFAULT_EXECUTION_ALLOWLIST = Object.freeze({
  taskTypes: Object.freeze(['github_pr_read_only_review']),
  approvalClasses: Object.freeze(['READ_ONLY']),
})

// Hard session bounds. These defaults are the contracted ceiling values:
// at most 3 orders per session, at most 30 minutes total runtime, at most
// 15 minutes per order, and automatic exit after 2 minutes without work.
export const BOUNDED_SESSION_DEFAULTS = Object.freeze({
  maxOrdersPerSession: 3,
  sessionBudgetMs: 30 * 60_000,
  perOrderBudgetMs: 15 * 60_000,
  idleExitMs: 2 * 60_000,
  pollMs: 5_000,
})

// Every session termination carries exactly one of these reasons in its exit
// evidence. Exit evidence is written on every result, including signals,
// timeouts, and abnormal exits.
export const SESSION_EXIT_REASONS = Object.freeze([
  'ORDER_CAP_REACHED',
  'SESSION_TIME_EXHAUSTED',
  'IDLE_EXIT',
  'SIGNAL_SHUTDOWN',
  'WORKER_LOCK_UNAVAILABLE',
  'WORKER_ENVIRONMENT_REJECTED',
  'ABNORMAL_EXIT',
])
