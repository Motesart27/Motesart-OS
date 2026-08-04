// Z1Today.jsx — Z1 Today zone (PLAN §8 Z1, §9, §10).
// Tiles: Z1Greeting (client clock) · Z1SignalFeed (tasks, 60s) · Z1Agenda
// (calendar, 300s) · Z1HandledLog (audit, 300s). Pre-B2 law (§3.8): zero
// FM-derived signals — the feed maps MASTER_TASKS only (z1Signals.js).

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chip } from '../components/index.jsx'
import { Tile } from './Tile.jsx'
import { useTileSource } from '../data/useTileSource.js'
import { fetchTasks, mapTasks } from '../data/adapters/tasks.js'
import { fetchCalendarEvents, mapCalendarEvents } from '../data/adapters/calendar.js'
import { fetchHandledLog, mapHandledLog } from '../data/adapters/auditLog.js'
import { rankSignals } from '../data/tileMachine.js'
import { SIGNAL_SEVERITY_LABELS, signalsFromTasks } from './z1Signals.js'
import { agendaForToday, formatEventTime, greetingForHour } from './z1Agenda.js'
import { useNow } from './useNow.js'

const TASKS_CADENCE_MS = 60000
const CALENDAR_CADENCE_MS = 300000
const AUDIT_CADENCE_MS = 300000

// ─── Greeting + date (client-derived, no endpoint) ──────────────────────────

export function Z1Greeting() {
  const now = useNow(30000)
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now)
  return (
    <header className="v2-stage-heading">
      <p>THE COCKPIT</p>
      <h1 id="v2-home-title">{greetingForHour(now.getHours())}, Denarius.</h1>
      <span>{dateLabel}</span>
    </header>
  )
}

// ─── Signal feed (max 6, ranked crit>exec>ai>warn>info>good) ────────────────

async function signalFeedFetcher(signal) {
  const result = await fetchTasks(signal, { limit: 200 })
  if (!result.ok) return result
  const { tasks } = mapTasks(result.data)
  const signals = rankSignals(signalsFromTasks(tasks))
  return { ...result, viewData: { signals }, resolution: signals.length === 0 ? 'empty' : 'populated' }
}

export function Z1SignalFeed() {
  const navigate = useNavigate()
  const { status, data, error, updatedAt, retry } = useTileSource({
    fetcher: signalFeedFetcher,
    cadenceMs: TASKS_CADENCE_MS,
  })
  const signals = useMemo(() => (data && Array.isArray(data.signals) ? data.signals : []), [data])

  return (
    <Tile
      title="Signals"
      status={status}
      error={error}
      updatedAt={updatedAt}
      onRetry={retry}
      emptyCopy="Quiet so far — nothing needs you."
      skeletonRows={3}
      className="v2-z1__signals"
    >
      <ul className="v2-signal-list">
        {signals.map((signal) => (
          <li key={signal.id}>
            <button
              type="button"
              role="link"
              className="v2-signal-row"
              onClick={() => navigate(signal.route)}
            >
              <Chip tone={signal.severity}>{SIGNAL_SEVERITY_LABELS[signal.severity] || signal.severity}</Chip>
              <span className="v2-signal-row__summary">{signal.summary}</span>
              <span className="v2-signal-row__arrow" aria-hidden="true">→</span>
            </button>
          </li>
        ))}
      </ul>
    </Tile>
  )
}

// ─── Today agenda (display-only; titles server-sanitized, plain text) ───────

async function agendaFetcher(signal) {
  const result = await fetchCalendarEvents(signal, { daysAhead: 1, maxResults: 20 })
  if (!result.ok) return result
  const { events } = mapCalendarEvents(result.data)
  const agenda = agendaForToday(events)
  return { ...result, viewData: { events: agenda }, resolution: agenda.length === 0 ? 'empty' : 'populated' }
}

export function Z1Agenda() {
  const { status, data, error, updatedAt, retry } = useTileSource({
    fetcher: agendaFetcher,
    cadenceMs: CALENDAR_CADENCE_MS,
  })
  const events = useMemo(() => (data && Array.isArray(data.events) ? data.events : []), [data])

  return (
    <Tile
      title="Today agenda"
      status={status}
      error={error}
      updatedAt={updatedAt}
      onRetry={retry}
      emptyCopy="Nothing scheduled today."
      skeletonRows={2}
      className="v2-z1__agenda"
    >
      <ul className="v2-agenda-list">
        {events.map((event, index) => (
          <li className="v2-agenda-slot" key={`${event.start}-${index}`}>
            <span className="v2-agenda-slot__time">{formatEventTime(event.start)}</span>
            <span className="v2-agenda-slot__title">{event.title}</span>
          </li>
        ))}
      </ul>
    </Tile>
  )
}

// ─── Handled-log digest (quiet: hidden while loading, on error incl. 401,
//     and when empty; G9 result_summary → response_text fallback lives in
//     the adapter mapper) ────────────────────────────────────────────────────

async function handledLogFetcher(signal) {
  const result = await fetchHandledLog(signal, 3)
  if (!result.ok) return result
  const view = mapHandledLog(result.data)
  return { ...result, viewData: view, resolution: view.empty ? 'empty' : 'populated' }
}

export function Z1HandledLog() {
  const { status, data } = useTileSource({
    fetcher: handledLogFetcher,
    cadenceMs: AUDIT_CADENCE_MS,
  })
  const items = data && Array.isArray(data.items) ? data.items : []
  const latest = (status === 'populated' || status === 'stale') && items.length > 0 ? items[0] : null
  if (!latest || !latest.summary) return null
  return (
    <p className="v2-handled-log">
      <span className="v2-tile__dot v2-tile__dot--good" aria-hidden="true" />
      <span>Handled quietly: {latest.summary}</span>
    </p>
  )
}

// ─── Zone composition ───────────────────────────────────────────────────────

export default function Z1Today() {
  return (
    <div className="v2-zone__body v2-z1">
      <Z1SignalFeed />
      <Z1Agenda />
      <Z1HandledLog />
    </div>
  )
}
