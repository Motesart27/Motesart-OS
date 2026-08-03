// adapters/tasks.js — MOSV2-C MASTER_TASKS adapter (PLAN §4 Domain 1, §7).
// Serves the Z1 signal feed, Z2 project grouping, and the Z3 pulse tile.
// Thin fetch layer over same-origin /api/* plus pure mappers that tolerate
// sparse optional fields (live audit: assigned_agent / requires_approval may
// be absent per record). Adapters never render; zones never fetch directly.

import { apiFetch } from '../apiFetch.js'

export function fetchTasks(signal, { business, limit } = {}) {
  const params = new URLSearchParams()
  if (business) params.set('business', business)
  if (limit) params.set('limit', String(limit))
  const query = params.toString()
  return apiFetch(`/api/tasks${query ? `?${query}` : ''}`, { signal })
}

export function fetchPulse(signal) {
  return apiFetch('/api/pulse', { signal })
}

const toArray = (value) => (Array.isArray(value) ? value : [])

// Normalizes one MASTER_TASKS record. Optional fields default to null when
// absent — sparse-field rule from the live field audit (§3.4 endpoint 1).
export function mapTask(record) {
  const r = record && typeof record === 'object' ? record : {}
  return {
    id: r.id ?? null,
    title: r.title ?? '',
    business: r.business ?? null,
    status: r.status ?? null,
    priority: r.priority ?? null,
    owner: r.owner ?? null,
    assignedAgent: r.assigned_agent ?? null,
    requiresApproval: r.requires_approval ?? null,
    approvalStatus: r.approval_status ?? null,
    dueDate: r.due_date ?? null,
    nextAction: r.next_action ?? null,
    projectOrArea: r.project_or_area ?? null,
    taskContext: r.task_context ?? null,
    source: r.source ?? null,
    createdAt: r.created_at ?? null,
  }
}

export function mapTasks(payload) {
  const tasks = toArray(payload && payload.tasks).map(mapTask)
  return { tasks, count: tasks.length, empty: tasks.length === 0 }
}

// Live-audit clarification (§3.4 endpoint 2): pulse buckets are ARRAYS of task
// objects — the tile counts lengths, never reads a pre-computed count.
export const PULSE_BUCKETS = Object.freeze(['urgent', 'overdue', 'blocked', 'approval', 'done_today', 'stale'])

export function mapPulse(payload) {
  const pulse = (payload && payload.pulse) || {}
  const counts = {}
  let total = 0
  for (const bucket of PULSE_BUCKETS) {
    counts[bucket] = toArray(pulse[bucket]).length
    total += counts[bucket]
  }
  return { counts, total, empty: total === 0 }
}
