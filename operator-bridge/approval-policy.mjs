import { APPROVAL_CLASSES } from './constants.mjs'

export class ApprovalPolicyError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'ApprovalPolicyError'
    this.code = code
  }
}

export class ApprovalPolicy {
  evaluate({ approvalClass, executor, approver, phaseAllowsProtectedWrites = false }) {
    if (!Object.values(APPROVAL_CLASSES).includes(approvalClass)) {
      throw new ApprovalPolicyError('UNKNOWN_APPROVAL_CLASS', 'Approval class is not recognized')
    }
    if (executor && approver && executor === approver) {
      throw new ApprovalPolicyError('SELF_APPROVAL_REJECTED', 'An executor cannot approve its own work')
    }
    if (approvalClass === APPROVAL_CLASSES.READ_ONLY) {
      return { allowed: true, requires_human: false, code: 'READ_ONLY_ALLOWED' }
    }
    if (!phaseAllowsProtectedWrites) {
      return { allowed: false, requires_human: true, code: 'PHASE_1_PROTECTED_WRITE_DISABLED' }
    }
    return { allowed: false, requires_human: true, code: 'HUMAN_APPROVAL_REQUIRED' }
  }
}
