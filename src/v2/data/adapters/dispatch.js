// adapters/dispatch.js — MOSV2-C Z5 quick-action dispatch adapter (PLAN §4
// Domain 1 write row, §8 Z5, §10 qbtn). Serves the single authorized Phase C
// write: quick action → create_task_core (the same core the voice/agent path
// uses), body title/business/assigned_agent/requires_approval, response
// {"ok","task":{"id","deduped",...}}.
//
// LIVE-PATH STATUS — intentionally not shipped this stage: the PLAN gates
// wiring the write behind the §3.4 live field-verification gate on the write's
// response shape plus a preview-deploy dispatch smoke proving
// approval_status:"pending" lands and nothing executes, and the session owner
// has authorized NO real Z5 submission. This module therefore contains NO
// fetch, NO apiFetch import, and NO POST — exactly the §3.8 precedent of the
// fm adapter shipping with its live path inactive (there, not shipped at all).
// What ships is the lawful fixture-backed path: body construction, response
// normalization, and a deterministic zero-network dispatcher that simulates
// the backend's approval-gated outcome (requires_approval:true ⇒
// approval_status:"pending" — approval never blocks creation; nothing here
// ever executes an action). Adapters never render; zones never fetch directly.

// create_task_core write body (PLAN §4: requires title + business; optional
// priority, owner, assigned_agent, due_date, requires_approval, … — same
// lowercase field set as Domain 1, case-sensitive per Airtable discipline).
// Every quick action is approval-gated: requires_approval is always true, so
// the backend records approval_status "pending" and the action never executes
// without approval. `priority` passes through only when the action defines
// one — no unruled value is invented for the five locked actions.
export function buildDispatchBody(action) {
  const a = action && typeof action === 'object' ? action : {}
  const body = {
    title: typeof a.label === 'string' ? a.label : '',
    business: a.business ?? null,
    assigned_agent: a.executive ?? null,
    requires_approval: true,
  }
  if (a.priority != null) body.priority = a.priority
  return body
}

// Normalizes a create_task_core response payload {"ok","task":{...}}.
// deduped:true is a SUCCESS (the backend returned the existing record — same
// business + non-done + normalized title), never a failure. Anything malformed
// maps to ok:false and never throws — a dispatch failure is a toast, not a
// crash. executive comes from the response's assigned_agent when present.
export function mapDispatchResponse(payload) {
  if (!payload || typeof payload !== 'object' || payload.ok !== true) {
    return { ok: false, id: null, deduped: null, approvalStatus: null, executive: null }
  }
  const task = payload.task && typeof payload.task === 'object' ? payload.task : null
  if (!task) {
    return { ok: false, id: null, deduped: null, approvalStatus: null, executive: null }
  }
  return {
    ok: true,
    id: task.id ?? null,
    deduped: task.deduped === true,
    approvalStatus: task.approval_status ?? null,
    executive: task.assigned_agent ?? null,
  }
}

// Normalizes an apiFetch-style typed result ({ ok, status, data, errorKind })
// into the dispatch outcome the zone toasts on. Failure results (network,
// http, permission, mock) and malformed success payloads both land ok:false.
export function mapDispatchResult(result) {
  if (!result || typeof result !== 'object' || result.ok !== true) {
    return { ok: false, id: null, deduped: null, approvalStatus: null, executive: null }
  }
  return mapDispatchResponse(result.data)
}

// Deterministic FIXTURE-BACKED dispatcher — zero network, no timers, no side
// effects. Simulates the verified backend contract for the approval-gated
// write: 201-style typed result, create_task_core response shape, deduped
// false, approval_status "pending" (requires_approval is always true). This is
// the only dispatch path wired in the cockpit this stage; the live POST wires
// only after the §3.4 gate and the preview-deploy smoke (see header).
export function fixtureDispatch(action) {
  const body = buildDispatchBody(action)
  const key = action && typeof action.key === 'string' ? action.key : 'unknown'
  return Promise.resolve({
    ok: true,
    status: 201,
    data: {
      ok: true,
      task: {
        id: `rec-fix-dispatch-${key}`,
        deduped: false,
        title: body.title,
        business: body.business,
        assigned_agent: body.assigned_agent,
        requires_approval: true,
        approval_status: 'pending',
      },
    },
    errorKind: null,
  })
}
