// Z4Personal.jsx — Z4 Life zone (PLAN §8 Z4, §9, §10 — G3 restricted set).
// Tiles: Z4PersonalTasks (Personal task lane, 900s) · Z4PersonalCalendar
// (server-merged personal-calendar events, 300s). G3 law: ONLY these two
// sources — no VitalStack, no travel/people responses, no invented metrics;
// absence renders quiet-empty, never an error. Both tiles are display-only
// (§10 personal tile row: hover wash only, tab-skipped).

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Tile } from './Tile.jsx'
import { useTileSource } from '../data/useTileSource.js'
import { fetchPersonalTasks, mapPersonalTasks } from '../data/adapters/personal.js'
import { fetchCalendarEvents, mapCalendarEvents } from '../data/adapters/calendar.js'
import { formatDueDate, openPersonalTasks } from './z4Personal.js'
import { agendaForToday, formatEventTime } from './z1Agenda.js'

const PERSONAL_CADENCE_MS = 900000
const CALENDAR_CADENCE_MS = 300000

// ─── Personal tasks (G3: Personal lane of MASTER_TASKS only; quiet-empty
//     when no open Personal tasks — absence is never an error) ───────────────

async function personalTasksFetcher(signal) {
  const result = await fetchPersonalTasks(signal)
  if (!result.ok) return result
  const view = mapPersonalTasks(result.data)
  const open = openPersonalTasks(view.tasks)
  return { ...result, viewData: { tasks: open }, resolution: open.length === 0 ? 'empty' : 'populated' }
}

export function Z4PersonalTasks() {
  const { status, data, error, updatedAt, retry } = useTileSource({
    fetcher: personalTasksFetcher,
    cadenceMs: PERSONAL_CADENCE_MS,
  })
  const tasks = useMemo(() => (data && Array.isArray(data.tasks) ? data.tasks : []), [data])

  return (
    <Tile
      title="Personal tasks"
      status={status}
      error={error}
      updatedAt={updatedAt}
      onRetry={retry}
      emptyCopy="No personal tasks open."
      skeletonRows={2}
      className="v2-z4__tasks"
    >
      <ul className="v2-personal-list">
        {tasks.map((task, index) => (
          <li className="v2-personal-row" key={task.id != null ? task.id : index}>
            <span className="v2-personal-row__title">{task.title}</span>
            <span className="v2-personal-row__due">{formatDueDate(task.dueDate)}</span>
          </li>
        ))}
      </ul>
    </Tile>
  )
}

// ─── Personal calendar (G3: server-merged personal-calendar events via the
//     shared calendar adapter; titles server-sanitized, plain text only;
//     quiet-empty "Nothing tracked today.") ───────────────────────────────────

async function personalCalendarFetcher(signal) {
  const result = await fetchCalendarEvents(signal, { daysAhead: 1, maxResults: 20 })
  if (!result.ok) return result
  const { events } = mapCalendarEvents(result.data)
  const agenda = agendaForToday(events)
  return { ...result, viewData: { events: agenda }, resolution: agenda.length === 0 ? 'empty' : 'populated' }
}

export function Z4PersonalCalendar() {
  const { status, data, error, updatedAt, retry } = useTileSource({
    fetcher: personalCalendarFetcher,
    cadenceMs: CALENDAR_CADENCE_MS,
  })
  const events = useMemo(() => (data && Array.isArray(data.events) ? data.events : []), [data])

  return (
    <Tile
      title="Personal calendar"
      status={status}
      error={error}
      updatedAt={updatedAt}
      onRetry={retry}
      emptyCopy="Nothing tracked today."
      skeletonRows={2}
      className="v2-z4__calendar"
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

// ─── Zone composition ───────────────────────────────────────────────────────

export default function Z4Personal() {
  return (
    <div className="v2-zone__body v2-z4">
      <Z4PersonalTasks />
      <Z4PersonalCalendar />
      <Link className="v2-zone-link" to="/v2/life">Open Life →</Link>
    </div>
  )
}
