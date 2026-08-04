// z1Signals.js — Z1 Today signal-feed derivation (PLAN §8 Z1, §3.8 pre-B2).
// Pure and dependency-free: no fetch, no timers, no React. Input is the mapped
// task shape from adapters/tasks.js (mapTask) — optional fields may be null
// (sparse-field rule from the live field audit) and never crash the mapping.
//
// Deterministic task → signal mapping (exactly one signal per task, first
// matching rule wins, in severity-rank order):
//   1. crit — due_date is in the past (end of its local day) AND status is not
//      'done' AND priority is 'urgent'
//   2. exec — approval_status is 'pending'
//   3. warn — status is 'blocked'
//   4. info — due_date falls on today (local timezone)
//   Everything else produces NO signal.
//
// Pre-B2 law (§3.8): no FM-derived signal exists anywhere in this module —
// signals come from MASTER_TASKS only, including tasks in the FM business
// lane (a task is a task; the prohibition is on FM *financial* values).

// Owning-module L2 routes per business lane (PLAN §10 row routing, 9.4).
export const BUSINESS_ROUTES = Object.freeze({
  E7A: '/v2/work',
  SOM: '/v2/som',
  FM: '/v2/money',
  Book: '/v2/book',
  Personal: '/v2/life',
})

// Severity shown as TEXT on every row — never color-alone (a11y gate).
export const SIGNAL_SEVERITY_LABELS = Object.freeze({
  crit: 'Critical',
  exec: 'Executive',
  ai: 'Mya',
  warn: 'Warning',
  info: 'Info',
  good: 'Good',
})

const DEFAULT_ROUTE = '/v2/home'

export function routeForBusiness(business) {
  return BUSINESS_ROUTES[business] || DEFAULT_ROUTE
}

const toDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// A due date counts as overdue once its local calendar day has fully passed —
// "due yesterday" is overdue, "due earlier today" is not (it is due today).
export function isOverdue(dueDate, status, now = new Date()) {
  if (status === 'done') return false
  const due = toDate(dueDate)
  if (!due) return false
  const endOfDueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1)
  return now.getTime() >= endOfDueDay.getTime()
}

export function isDueToday(dueDate, now = new Date()) {
  const due = toDate(dueDate)
  if (!due) return false
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  )
}

// One task → one signal, or null when no rule matches.
export function signalFromTask(task, now = new Date()) {
  if (!task || typeof task !== 'object') return null
  const summary = task.title || 'Untitled task'
  const route = routeForBusiness(task.business)
  const base = { id: task.id != null ? `sig-${task.id}` : null, summary, route }

  if (isOverdue(task.dueDate, task.status, now) && task.priority === 'urgent') {
    return { ...base, severity: 'crit' }
  }
  if (task.approvalStatus === 'pending') {
    return { ...base, severity: 'exec' }
  }
  if (task.status === 'blocked') {
    return { ...base, severity: 'warn' }
  }
  if (isDueToday(task.dueDate, now)) {
    return { ...base, severity: 'info' }
  }
  return null
}

// All tasks → raw signal list (UNRANKED, uncapped). Ranking and the max-6 cap
// are rankSignals' job (tileMachine.js) — call it on this output.
export function signalsFromTasks(tasks, now = new Date()) {
  const list = Array.isArray(tasks) ? tasks : []
  return list
    .map((task, index) => {
      const signal = signalFromTask(task, now)
      if (!signal) return null
      // Tasks without an id still get a stable, deterministic signal id.
      return signal.id ? signal : { ...signal, id: `sig-idx-${index}` }
    })
    .filter(Boolean)
}
