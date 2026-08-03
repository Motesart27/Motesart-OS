// z2Projects.js — Z2 Projects derivation (PLAN §8 Z2, G1 Book task lane).
// Pure and dependency-free: no fetch, no timers, no React. Input is the mapped
// task shape from adapters/tasks.js (mapTask); optional fields may be null
// (sparse-field rule from the live field audit) and never crash the mapping.

import { computeCountdown } from '../data/tileMachine.js'

// Canonical business lanes (PLAN §4 Domain 1 enum), in cockpit order.
export const BUSINESS_LANES = Object.freeze(['E7A', 'SOM', 'FM', 'Book', 'Personal'])

// Known MASTER_TASKS statuses (PLAN §4 Domain 1 enum). Unknown/absent statuses
// count toward the lane total but toward no bucket — sparse-field tolerant.
export const TASK_STATUSES = Object.freeze(['pending', 'in_progress', 'blocked', 'done'])

const emptyCounts = () => ({ pending: 0, in_progress: 0, blocked: 0, done: 0 })

// Group tasks client-side by business lane. Returns one group per lane that
// has at least one task, in BUSINESS_LANES order. Tasks with an unknown or
// absent business lane are ignored (they belong to no cockpit lane).
export function groupTasksByBusiness(tasks) {
  const list = Array.isArray(tasks) ? tasks : []
  const groups = new Map()
  for (const task of list) {
    if (!task || !BUSINESS_LANES.includes(task.business)) continue
    if (!groups.has(task.business)) {
      groups.set(task.business, { business: task.business, total: 0, done: 0, percent: 0, counts: emptyCounts() })
    }
    const group = groups.get(task.business)
    group.total += 1
    if (TASK_STATUSES.includes(task.status)) group.counts[task.status] += 1
  }
  for (const group of groups.values()) {
    group.done = group.counts.done
    group.percent = group.total === 0 ? 0 : Math.round((group.done / group.total) * 100)
  }
  return BUSINESS_LANES.filter((lane) => groups.has(lane)).map((lane) => groups.get(lane))
}

const PRIORITY_RANK = Object.freeze({ urgent: 0, high: 1, medium: 2, low: 3 })
const PRIORITY_RANK_SIZE = Object.keys(PRIORITY_RANK).length

// G1 Book task-lane summary: count + top titles by priority (urgent > high >
// medium > low; unknown priority last; stable within a rank). This is
// task-based Book information ONLY — nothing here claims a Book system, base,
// or BK_* read model exists.
export function summarizeBookLane(tasks, { limit = 3 } = {}) {
  const list = Array.isArray(tasks) ? tasks : []
  const ranked = list
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const ra = PRIORITY_RANK[a.task && a.task.priority] ?? PRIORITY_RANK_SIZE
      const rb = PRIORITY_RANK[b.task && b.task.priority] ?? PRIORITY_RANK_SIZE
      return ra - rb || a.index - b.index
    })
  return {
    count: list.length,
    topTitles: ranked.slice(0, limit).map((entry) => ({
      id: entry.task && entry.task.id != null ? entry.task.id : null,
      title: (entry.task && entry.task.title) || 'Untitled task',
      priority: (entry.task && entry.task.priority) || null,
    })),
    empty: list.length === 0,
  }
}

export const MAX_COUNTDOWNS = 3

// Up to MAX_COUNTDOWNS nearest FUTURE dated tasks, derived from due_date only
// (client-side; no hardcoded dates). Past, absent, and unparseable due dates
// are excluded — computeCountdown returns null for them and they drop out.
export function deriveCountdowns(tasks, { now = new Date(), limit = MAX_COUNTDOWNS } = {}) {
  const list = Array.isArray(tasks) ? tasks : []
  return list
    .map((task, index) => {
      if (!task || !task.dueDate) return null
      const countdown = computeCountdown(task.dueDate, now)
      if (!countdown) return null
      return {
        id: task.id != null ? `cd-${task.id}` : `cd-idx-${index}`,
        label: task.title || 'Untitled task',
        business: task.business || null,
        targetMs: countdown.targetMs,
        countdown,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.targetMs - b.targetMs)
    .slice(0, limit)
}

// Compact countdown text: "2d 21h" or "5h". Never renders for a past target.
export function formatCountdown(countdown) {
  if (!countdown) return ''
  return countdown.days > 0 ? `${countdown.days}d ${countdown.hours}h` : `${countdown.hours}h`
}
