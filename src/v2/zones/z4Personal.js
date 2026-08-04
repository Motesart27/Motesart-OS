// z4Personal.js — Z4 Life/Personal derivation (PLAN §8 Z4, G3 restricted set).
// Pure and dependency-free: no fetch, no timers, no React. Input is the mapped
// task shape from adapters/personal.js (mapPersonalTasks → adapters/tasks.js
// mapTask); optional fields may be null (sparse-field rule from the live field
// audit) and never crash the mapping. Nothing here touches VitalStack, travel,
// people, or any invented health/life metric — those stay excluded (G3).

const PRIORITY_RANK = Object.freeze({ urgent: 0, high: 1, medium: 2, low: 3 })
const PRIORITY_RANK_SIZE = Object.keys(PRIORITY_RANK).length

const dueTime = (task) => {
  if (!task || !task.dueDate) return Number.POSITIVE_INFINITY
  const time = new Date(task.dueDate).getTime()
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}

export const MAX_PERSONAL_TASKS = 5

// Open Personal-lane tasks (status !== 'done'), ranked by priority
// (urgent > high > medium > low; unknown/absent priority last), then soonest
// due date (absent/unparseable due dates last), stable within a rank. Absence
// is quiet-empty (G3): an empty or non-array input yields an empty list and
// the tile renders its quiet line, never an error.
export function openPersonalTasks(tasks, { limit = MAX_PERSONAL_TASKS } = {}) {
  const list = Array.isArray(tasks) ? tasks : []
  return list
    .map((task, index) => ({ task, index }))
    .filter((entry) => entry.task && entry.task.status !== 'done')
    .sort((a, b) => {
      const pa = PRIORITY_RANK[a.task.priority] ?? PRIORITY_RANK_SIZE
      const pb = PRIORITY_RANK[b.task.priority] ?? PRIORITY_RANK_SIZE
      return pa - pb || dueTime(a.task) - dueTime(b.task) || a.index - b.index
    })
    .slice(0, limit)
    .map((entry) => ({
      id: entry.task.id != null ? entry.task.id : null,
      title: entry.task.title || 'Untitled task',
      status: entry.task.status || null,
      priority: entry.task.priority || null,
      dueDate: entry.task.dueDate || null,
    }))
}

// Compact due-date label ("Aug 6"). Absent or unparseable → em-dash, the
// partial-value rule (§8); the row still renders its title. Airtable
// due_date is a bare calendar date — parsed as local midnight, never UTC,
// so the rendered day is the recorded day.
export function formatDueDate(dueDate) {
  if (!dueDate) return '—'
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? `${dueDate}T00:00:00` : dueDate)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}
