// founderData.js — Founder Home pure composition layer (branch feat/founder-home-mobile).
// No fetch, no timers, no React — every derivation is pure and unit-testable.
// Data enters only through the existing MOSV2-C adapters (tasks / pulse /
// calendar / handled-log). Nothing here duplicates Airtable state; sections are
// views over the same MASTER_TASKS payloads the zones already consume.
//
// Founder truth law (directive 2026-08-07): every founder-visible module
// distinguishes LIVE / STAGED / UNVERIFIED / UNAVAILABLE. This module owns the
// mapping from the tile-machine state + data classification to that law.
// Fixture or mock data can never receive the LIVE label here.

import { DATA_CLASSIFICATION, TILE_STATUS } from '../data/tileMachine.js'
import { mapTask } from '../data/adapters/tasks.js'
import { APP_LAUNCHERS } from '../../config/appLaunchers.js'

export const TRUTH = Object.freeze({
  LIVE: 'LIVE',
  STAGED: 'STAGED',
  UNVERIFIED: 'UNVERIFIED',
  UNAVAILABLE: 'UNAVAILABLE',
})

// Tile state + classification → founder truth chip.
//   FIXTURE            → STAGED      (deterministic gallery/QA data)
//   MOCK               → UNVERIFIED  (a source returned mock — integrity unknown)
//   UNAVAILABLE_LIVE   → UNAVAILABLE (ruling: not yet wired, e.g. FM pre-B2)
//   DEFERRED           → UNAVAILABLE (ruling: intentionally not connected)
//   b2-pending         → UNAVAILABLE
//   permission-denied  → UNAVAILABLE (sign-in needed)
//   error (no data)    → UNAVAILABLE
//   offline, nothing held → UNAVAILABLE (no data to stand behind)
//   stale / offline with last-good → UNVERIFIED (real data, freshness unconfirmed)
//   populated/partial/empty → LIVE   (empty is a truthful zero, never fabricated)
//
// hasData tells the offline branch whether last-good content is still on
// screen. STALE always implies retained data by tile-machine construction, so
// it needs no hasData signal.
export function truthForTile({ status, classification = DATA_CLASSIFICATION.LIVE, hasData = false } = {}) {
  if (classification === DATA_CLASSIFICATION.FIXTURE) return TRUTH.STAGED
  if (classification === DATA_CLASSIFICATION.MOCK) return TRUTH.UNVERIFIED
  if (classification === DATA_CLASSIFICATION.UNAVAILABLE_LIVE || classification === DATA_CLASSIFICATION.DEFERRED) return TRUTH.UNAVAILABLE
  switch (status) {
    case TILE_STATUS.B2_PENDING:
    case TILE_STATUS.PERMISSION_DENIED:
    case TILE_STATUS.ERROR:
      return TRUTH.UNAVAILABLE
    case TILE_STATUS.OFFLINE:
      return hasData ? TRUTH.UNVERIFIED : TRUTH.UNAVAILABLE
    case TILE_STATUS.STALE:
      return TRUTH.UNVERIFIED
    case TILE_STATUS.POPULATED:
    case TILE_STATUS.PARTIAL:
    case TILE_STATUS.EMPTY:
      return TRUTH.LIVE
    default:
      // idle/loading: data not yet arrived — no claim made either way.
      return null
  }
}

const toArray = (value) => (Array.isArray(value) ? value : [])
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 }

function mapWithLatest(record) {
  const base = mapTask(record)
  return { ...base, latestUpdate: (record && record.latest_update_summary) ?? null }
}

function pulseItems(payload, bucket) {
  return toArray(payload && payload.pulse && payload.pulse[bucket]).map(mapWithLatest)
}

// ── MYA Briefing ────────────────────────────────────────────────────
// One-glance operational sentence from the same pulse feed Z3 uses.
export function deriveBriefing(pulsePayload) {
  const pulse = (pulsePayload && pulsePayload.pulse) || {}
  const counts = {
    urgent: toArray(pulse.urgent).length,
    overdue: toArray(pulse.overdue).length,
    blocked: toArray(pulse.blocked).length,
    approval: toArray(pulse.approval).length,
    doneToday: toArray(pulse.done_today).length,
  }
  const parts = []
  if (counts.approval > 0) parts.push(`${counts.approval} approval${counts.approval > 1 ? 's' : ''} waiting`)
  if (counts.urgent > 0) parts.push(`${counts.urgent} urgent`)
  if (counts.overdue > 0) parts.push(`${counts.overdue} overdue`)
  if (counts.blocked > 0) parts.push(`${counts.blocked} blocked`)
  const allClear = parts.length === 0
  if (allClear) parts.push('No fires')
  if (counts.doneToday > 0) parts.push(`${counts.doneToday} completed today`)
  return { counts, allClear, line: parts.join(' · ') }
}

// Latest handled-log line (what MYA last did), G9 fallback preserved by adapter.
export function deriveLatestHandled(handledData) {
  const items = toArray(handledData && handledData.items)
  const first = items[0]
  if (!first) return null
  return { summary: first.summary || '', route: first.route ?? null, timestamp: first.timestamp ?? null }
}

// ── One Required Founder Action ─────────────────────────────────────
// Deterministic selection: approvals first (founder-only gate), then urgent,
// then overdue. Exactly one — the screen never demands two things at once.
export function deriveRequiredAction(pulsePayload) {
  const approval = pulseItems(pulsePayload, 'approval')
  if (approval.length > 0) return { task: approval[0], reason: 'Approval needed' }
  const urgent = pulseItems(pulsePayload, 'urgent')
  if (urgent.length > 0) return { task: urgent[0], reason: 'Urgent' }
  const overdue = pulseItems(pulsePayload, 'overdue')
  if (overdue.length > 0) return { task: overdue[0], reason: 'Overdue' }
  return null
}

// ── Top Priorities ──────────────────────────────────────────────────
export function derivePriorities(tasksPayload, { limit = 5 } = {}) {
  const tasks = toArray(tasksPayload && tasksPayload.tasks).map(mapWithLatest)
  return tasks
    .filter((task) => task.status !== 'done' && (task.priority === 'urgent' || task.priority === 'high'))
    .sort((a, b) => {
      const rankDelta = (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
      if (rankDelta !== 0) return rankDelta
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
      return aDue - bDue
    })
    .slice(0, limit)
}

// ── Approvals / Blockers / Active Work / Recent Completions ─────────
export function deriveApprovals(pulsePayload) {
  return pulseItems(pulsePayload, 'approval')
}

export function deriveBlockers(pulsePayload) {
  return [...pulseItems(pulsePayload, 'blocked'), ...pulseItems(pulsePayload, 'overdue')]
}

export function deriveActiveWork(tasksPayload) {
  return toArray(tasksPayload && tasksPayload.tasks)
    .map(mapWithLatest)
    .filter((task) => task.status === 'in_progress')
}

export function deriveCompletions(pulsePayload) {
  return pulseItems(pulsePayload, 'done_today')
}

// ── System Health ───────────────────────────────────────────────────
// Composed from the tile states of the sources this screen actually consumed —
// never a separate endpoint, never a green light without evidence.
export function deriveSystemHealth(sourceStates) {
  const entries = [
    ['Tasks', sourceStates.tasks],
    ['Pulse', sourceStates.pulse],
    ['Calendar', sourceStates.calendar],
    ['MYA log', sourceStates.audit],
  ]
  return entries.map(([name, state]) => ({
    name,
    truth: truthForTile({ ...(state || {}), hasData: Boolean(state && state.data != null) }),
    status: (state && state.status) || TILE_STATUS.IDLE,
  }))
}

// ── Business Launchers ──────────────────────────────────────────────
// Links, not data. Labels follow the repo's own LOCK 3 registry state:
// deployed properties are LIVE links; LOCK-3 staged entries are STAGED.
export function buildLaunchers() {
  const registry = APP_LAUNCHERS
  return [
    { id: 'som-app', label: registry['som-app'].label, url: registry['som-app'].url, initials: registry['som-app'].initials, color: registry['som-app'].color, truth: TRUTH.LIVE, note: 'Deployed app' },
    { id: 'book-app', label: registry['book-app'].label, url: registry['book-app'].url, initials: registry['book-app'].initials, color: registry['book-app'].color, truth: TRUTH.STAGED, note: 'Staged entry — LOCK 3' },
    { id: 'fm-app', label: registry['fm-app'].label, url: registry['fm-app'].url, initials: registry['fm-app'].initials, color: registry['fm-app'].color, truth: TRUTH.STAGED, note: 'Staged entry — LOCK 3' },
    { id: 'motesart-converter', label: 'Motesart Technologies', url: registry['motesart-converter'].url, initials: registry['motesart-converter'].initials, color: registry['motesart-converter'].color, truth: TRUTH.LIVE, note: 'Deployed tool' },
    { id: 'personal-mya', label: 'Personal / MYA', url: '/v2/life', initials: 'M', color: '#9668f0', truth: TRUTH.STAGED, note: 'Internal module — placeholder shell', internal: true },
  ]
}
