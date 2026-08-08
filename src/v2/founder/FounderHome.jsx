// FounderHome.jsx — phone-first Founder Home (branch feat/founder-home-mobile).
// Route: /v2/founder. Dedicated mobile frame (no desktop rail/topbar) composing
// the existing MOSV2-C sources through useTileSource — same MASTER_TASKS /
// calendar / handled-log feeds, no new endpoints, no duplicated state.
// Every section carries a founder-law truth chip: LIVE / STAGED / UNVERIFIED /
// UNAVAILABLE (mapping owned by founderData.truthForTile).

import { useMemo } from 'react'
import '../tokens.css'
import './founder.css'
import { useTileSource } from '../data/useTileSource.js'
import { TILE_STATUS } from '../data/tileMachine.js'
import { fetchTasks, fetchPulse } from '../data/adapters/tasks.js'
import { fetchCalendarEvents, mapCalendarEvents } from '../data/adapters/calendar.js'
import { fetchHandledLog, mapHandledLog } from '../data/adapters/auditLog.js'
import {
  TRUTH,
  truthForTile,
  deriveBriefing,
  deriveLatestHandled,
  deriveRequiredAction,
  derivePriorities,
  deriveApprovals,
  deriveBlockers,
  deriveActiveWork,
  deriveCompletions,
  deriveSystemHealth,
  buildLaunchers,
} from './founderData.js'

const CHIP_CLASS = {
  [TRUTH.LIVE]: 'fh-chip--live',
  [TRUTH.STAGED]: 'fh-chip--staged',
  [TRUTH.UNVERIFIED]: 'fh-chip--unverified',
  [TRUTH.UNAVAILABLE]: 'fh-chip--unavailable',
}

function TruthChip({ truth, updatedAt }) {
  if (!truth) return <span className="fh-chip fh-chip--pending">…</span>
  const detail = truth === TRUTH.UNVERIFIED && updatedAt ? ` · as of ${formatTime(updatedAt)}` : ''
  return <span className={`fh-chip ${CHIP_CLASS[truth]}`} data-truth={truth}>{truth}{detail}</span>
}

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatEventTime(event) {
  const start = formatTime(event.start)
  const end = event.end ? `–${formatTime(event.end)}` : ''
  return `${start}${end}`
}

// Section frame: title + truth chip + lawful bodies per tile state. Content
// states (populated/empty) render real copy; failure states never fabricate.
function Section({ title, state, emptyCopy, children, className = '' }) {
  // hasData carries last-good presence so first-load offline reads UNAVAILABLE
  // while offline-with-data reads UNVERIFIED (founder truth law).
  const truth = truthForTile({ ...state, hasData: state.data != null })
  let body
  switch (state.status) {
    case TILE_STATUS.IDLE:
    case TILE_STATUS.LOADING:
      body = <div className="fh-skeleton" aria-hidden="true"><i /><i /><i /></div>
      break
    case TILE_STATUS.ERROR:
      body = <p className="fh-quiet fh-quiet--crit">{state.error?.message || 'Source unreachable'}<RetryLink onRetry={state.retry} /></p>
      break
    case TILE_STATUS.PERMISSION_DENIED:
      body = <p className="fh-quiet fh-quiet--warn">Sign-in needed — this section resumes after you sign in again.<RetryLink onRetry={state.retry} /></p>
      break
    case TILE_STATUS.OFFLINE:
      body = state.data != null
        ? children
        : <p className="fh-quiet fh-quiet--warn">You appear to be offline.<RetryLink onRetry={state.retry} /></p>
      break
    case TILE_STATUS.EMPTY:
      body = <p className="fh-quiet fh-quiet--good">{emptyCopy}</p>
      break
    default:
      body = children
  }
  return (
    <section className={`fh-section ${className}`} aria-label={title} data-truth={truth || 'pending'}>
      <header className="fh-section__head">
        <h2>{title}</h2>
        <TruthChip truth={truth} updatedAt={state.updatedAt} />
      </header>
      {body}
    </section>
  )
}

function RetryLink({ onRetry }) {
  if (!onRetry) return null
  return <> <button type="button" className="fh-retry" onClick={onRetry}>Retry ↻</button></>
}

function TaskRow({ task, showAgent = false, showNextAction = false, showUpdate = false }) {
  return (
    <li className="fh-task">
      <div className="fh-task__top">
        <span className="fh-task__title">{task.title || 'Untitled task'}</span>
        {task.business && <span className="fh-tag">{task.business}</span>}
      </div>
      <div className="fh-task__meta">
        {showAgent && <span>Agent: {task.assignedAgent || '—'}</span>}
        {task.priority && <span>{task.priority}</span>}
        {task.dueDate && <span>due {task.dueDate}</span>}
      </div>
      {showNextAction && task.nextAction && <p className="fh-task__next">Next: {task.nextAction}</p>}
      {showUpdate && task.latestUpdate && <p className="fh-task__update">Latest: {task.latestUpdate}</p>}
    </li>
  )
}

const asView = (result, viewData, empty) =>
  result.ok ? { ...result, viewData, resolution: empty ? 'empty' : 'populated' } : result

export default function FounderHome() {
  const tasks = useTileSource({
    fetcher: async (signal) => {
      const result = await fetchTasks(signal, { limit: 100 })
      return asView(result, result.ok ? result.data : null, result.ok && !(result.data?.tasks?.length))
    },
    cadenceMs: 60000,
  })
  const pulse = useTileSource({
    // viewData must be the payload itself — briefing/action/approvals/
    // blockers/completions all derive from pulse.data downstream. Empty pulse
    // stays resolution 'populated': the derived sections render their own
    // truthful empty copy and the briefing line reports "No fires".
    fetcher: async (signal) => {
      const result = await fetchPulse(signal)
      return asView(result, result.ok ? result.data : null, false)
    },
    cadenceMs: 60000,
  })
  const calendar = useTileSource({
    fetcher: async (signal) => {
      const result = await fetchCalendarEvents(signal, { daysAhead: 1, maxResults: 8 })
      return asView(result, result.ok ? mapCalendarEvents(result.data) : null, result.ok && !(result.data?.events?.length))
    },
    cadenceMs: 5 * 60000,
  })
  const audit = useTileSource({
    fetcher: async (signal) => {
      const result = await fetchHandledLog(signal, 3)
      return asView(result, result.ok ? mapHandledLog(result.data) : null, result.ok && !(result.data?.items?.length))
    },
    cadenceMs: 5 * 60000,
  })

  const tasksData = tasks.data
  const pulseData = pulse.data
  const briefing = useMemo(() => (pulseData ? deriveBriefing(pulseData) : null), [pulseData])
  const latestHandled = useMemo(() => (audit.data ? deriveLatestHandled(audit.data) : null), [audit.data])
  const requiredAction = useMemo(() => (pulseData ? deriveRequiredAction(pulseData) : null), [pulseData])
  const priorities = useMemo(() => (tasksData ? derivePriorities(tasksData) : []), [tasksData])
  const approvals = useMemo(() => (pulseData ? deriveApprovals(pulseData) : []), [pulseData])
  const blockers = useMemo(() => (pulseData ? deriveBlockers(pulseData) : []), [pulseData])
  const activeWork = useMemo(() => (tasksData ? deriveActiveWork(tasksData) : []), [tasksData])
  const completions = useMemo(() => (pulseData ? deriveCompletions(pulseData) : []), [pulseData])
  const health = useMemo(
    () => deriveSystemHealth({ tasks, pulse, calendar, audit }),
    [tasks, pulse, calendar, audit],
  )
  const launchers = useMemo(() => buildLaunchers(), [])

  const daypart = (() => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening' })()
  const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

  const pulseTruth = truthForTile(pulse)

  return (
    <div className="fh-root">
      <header className="fh-header">
        <p className="fh-wordmark">MOTESART OS</p>
        <h1>Good {daypart}, Denarius</h1>
        <p className="fh-date">{dateLabel}</p>
      </header>

      <Section title="MYA Briefing" state={pulse} emptyCopy="All clear — nothing needs attention." className="fh-briefing">
        {briefing && <p className="fh-briefing__line">{briefing.line}</p>}
        {latestHandled
          ? <p className="fh-briefing__mya">MYA last handled: {latestHandled.summary}{latestHandled.timestamp ? ` · ${formatTime(latestHandled.timestamp)}` : ''}</p>
          : audit.status === TILE_STATUS.PERMISSION_DENIED
            ? <p className="fh-quiet fh-quiet--warn">MYA log: sign-in needed.</p>
            : null}
      </Section>

      <Section title="One Required Action" state={pulse} emptyCopy="No single action required right now." className="fh-action">
        {requiredAction
          ? (
            <div className="fh-action__card">
              <span className="fh-action__reason">{requiredAction.reason}</span>
              <p className="fh-action__title">{requiredAction.task.title}</p>
              {requiredAction.task.nextAction && <p className="fh-task__next">Next: {requiredAction.task.nextAction}</p>}
              <div className="fh-task__meta">
                {requiredAction.task.business && <span className="fh-tag">{requiredAction.task.business}</span>}
                {requiredAction.task.assignedAgent && <span>Agent: {requiredAction.task.assignedAgent}</span>}
              </div>
            </div>
          )
          : <p className="fh-quiet fh-quiet--good">No single action required right now.</p>}
      </Section>

      <Section title="Today" state={calendar} emptyCopy="Nothing scheduled today.">
        <ul className="fh-events">
          {(calendar.data?.events || []).map((event, index) => (
            <li key={index} className="fh-event">
              <span className="fh-event__time">{formatEventTime(event)}</span>
              <span className="fh-event__title">{event.title || event.summary}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Top Priorities" state={tasks} emptyCopy="No urgent or high-priority tasks open.">
        {priorities.length
          ? (
            <ul className="fh-tasks">
              {priorities.map((task) => <TaskRow key={task.id || task.title} task={task} showNextAction />)}
            </ul>
          )
          : <p className="fh-quiet fh-quiet--good">No urgent or high-priority tasks open.</p>}
      </Section>

      <Section title="Approvals Waiting" state={pulse} emptyCopy="Nothing waiting on your approval.">
        {approvals.length
          ? (
            <ul className="fh-tasks">
              {approvals.map((task) => <TaskRow key={task.id || task.title} task={task} />)}
            </ul>
          )
          : <p className="fh-quiet fh-quiet--good">Nothing waiting on your approval.</p>}
      </Section>

      <Section title="Blockers" state={pulse} emptyCopy="No blockers or overdue work.">
        {blockers.length
          ? (
            <ul className="fh-tasks">
              {blockers.map((task) => <TaskRow key={task.id || task.title} task={task} showAgent />)}
            </ul>
          )
          : <p className="fh-quiet fh-quiet--good">No blockers or overdue work.</p>}
      </Section>

      <Section title="Active Work" state={tasks} emptyCopy="No work in progress.">
        {activeWork.length
          ? (
            <ul className="fh-tasks">
              {activeWork.map((task) => <TaskRow key={task.id || task.title} task={task} showAgent showNextAction showUpdate />)}
            </ul>
          )
          : <p className="fh-quiet fh-quiet--good">No work in progress.</p>}
      </Section>

      <Section title="Recent Completions" state={pulse} emptyCopy="Nothing completed yet today.">
        {completions.length
          ? (
            <ul className="fh-tasks">
              {completions.map((task) => <TaskRow key={task.id || task.title} task={task} />)}
            </ul>
          )
          : <p className="fh-quiet fh-quiet--good">Nothing completed yet today.</p>}
      </Section>

      <section className="fh-section" aria-label="System Health">
        <header className="fh-section__head"><h2>System Health</h2></header>
        <ul className="fh-health">
          {health.map((entry) => (
            <li key={entry.name}>
              <span>{entry.name}</span>
              <TruthChip truth={entry.truth} />
            </li>
          ))}
        </ul>
      </section>

      <section className="fh-section" aria-label="Business Launchers">
        <header className="fh-section__head"><h2>Launchers</h2></header>
        <ul className="fh-launchers">
          {launchers.map((launcher) => (
            <li key={launcher.id}>
              <a className="fh-launcher" href={launcher.url} {...(launcher.internal ? {} : { target: '_blank', rel: 'noreferrer' })}>
                <span className="fh-launcher__tile" style={{ background: launcher.color }} aria-hidden="true">{launcher.initials}</span>
                <span className="fh-launcher__label">{launcher.label}<small>{launcher.note}</small></span>
                <TruthChip truth={launcher.truth} />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <footer className="fh-footer">
        <span>Founder Home · branch build</span>
        <span>pulse: {pulseTruth || '…'}</span>
      </footer>
    </div>
  )
}
