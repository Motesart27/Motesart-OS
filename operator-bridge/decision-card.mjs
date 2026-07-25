export function createDecisionCard({
  workOrder,
  originatingInstruction,
  artifacts,
  kimiResult,
  codexResult,
  fableResult,
  blockingFindings = [],
}) {
  const hasBlock = workOrder.status === 'BLOCKED' || fableResult?.status === 'BLOCKED'
  return {
    schema_version: 'motesart.operator_bridge.decision_card.v1',
    work_order_id: workOrder.work_order_id,
    originating_instruction: originatingInstruction,
    current_status: workOrder.status,
    current_executor: workOrder.executor,
    lease: {
      owner: workOrder.lease_owner,
      expires_at: workOrder.lease_expires_at,
      active: Boolean(workOrder.lease_owner && workOrder.lease_expires_at),
    },
    artifacts: artifacts.map((artifact) => ({
      artifact_id: artifact.artifact_id,
      artifact_type: artifact.artifact_type,
      immutable_relative_uri: artifact.immutable_relative_uri,
      sha256: artifact.sha256,
    })),
    kimi_architecture_result: kimiResult ?? null,
    codex_execution_result: codexResult ?? null,
    fable_result: fableResult ?? null,
    blocking_findings: blockingFindings,
    blocker_code: workOrder.blocker_code ?? fableResult?.blocker_code ?? null,
    next_action: workOrder.next_action,
    approval_class: workOrder.approval_class,
    controls: {
      approve: { enabled: false, reason: 'PHASE_1_NO_PROTECTED_APPROVAL_EXECUTION' },
      reject: { enabled: false, reason: 'PHASE_1_LOCAL_EVIDENCE_ONLY' },
      revise: { enabled: false, reason: 'PHASE_1_LOCAL_EVIDENCE_ONLY' },
    },
    human_decision_required: hasBlock || workOrder.approval_class !== 'READ_ONLY',
    generated_at: new Date().toISOString(),
  }
}
