// z5QuickActions.js — Z5 Quick Actions derivation (PLAN §8 Z5, §10 qbtn row).
// Pure and dependency-free: no fetch, no timers, no React, no imports.
//
// Source law for this zone:
//   · The five actions are locked by the desktop mockup (ZONE 5 · QUICK
//     ACTIONS) — labels and executive routes verbatim, in mockup order.
//   · Business lanes derive from the audited backend mapping (PLAN §4
//     default_agent: SOM→"SOM Executive", FM→"FM Executive",
//     Personal→"MYA") — never invented.
//   · Every action is approval-gated (requires_approval:true ⇒ the backend
//     records approval_status "pending"; approval never blocks creation and
//     nothing executes without approval).
//   · Toast copy is ruled: success "‹action› → routed to ‹executive›" from
//     assigned_agent; failure "couldn't route — try again", no auto-retry.

export const QUICK_ACTIONS = Object.freeze([
  { key: 'new-student', label: 'New student', business: 'SOM', executive: 'SOM Executive' },
  { key: 'create-invoice', label: 'Create invoice', business: 'FM', executive: 'FM Executive' },
  { key: 'brain-dump', label: 'Brain dump', business: 'Personal', executive: 'MYA' },
  { key: 'voice-note', label: 'Voice note', business: 'Personal', executive: 'MYA' },
  { key: 'capture-idea', label: 'Capture idea', business: 'Personal', executive: 'MYA' },
])

// Ruled failure copy (PLAN §8 Z5 / §10 qbtn error column) — verbatim.
export const DISPATCH_FAILURE_COPY = "couldn't route — try again"

// Ruled success copy (PLAN §8 Z5: "routed to ‹executive›" from
// assigned_agent; the desktop mockup's toast carries the action label and
// arrow). The response's executive (assigned_agent) wins; the action's own
// executive is the fallback for a sparse response.
export function dispatchSuccessCopy(action, executive = null) {
  const label = action && typeof action.label === 'string' ? action.label : ''
  const routed = executive || (action && action.executive) || null
  return routed ? `${label} → routed to ${routed}` : label
}

// Normalized dispatch outcome (adapters/dispatch.js mapDispatchResult) → the
// toast view { tone, copy }. ok ⇒ good tone with the ruled success copy;
// anything else ⇒ crit tone with the ruled failure copy. No auto-retry exists
// anywhere — a failure is exactly one toast.
export function dispatchToast(outcome, action) {
  if (outcome && outcome.ok === true) {
    return { tone: 'good', copy: dispatchSuccessCopy(action, outcome.executive) }
  }
  return { tone: 'crit', copy: DISPATCH_FAILURE_COPY }
}
