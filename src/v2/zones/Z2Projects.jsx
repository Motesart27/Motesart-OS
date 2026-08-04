// Z2Projects.jsx — Z2 Projects zone (PLAN §8 Z2, §9, §10).
// Tiles: Z2ProjectCards (tasks grouped by business, 60s) · Z2BookInfo (G1
// task-lane fallback, 900s) · Z2Countdowns (client-derived from due_date).
// The tasks source is fetched ONCE per zone and shared by project cards and
// countdowns (PLAN §8: one adapter per source, shared).

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, ProgressBar } from '../components/index.jsx'
import { Tile } from './Tile.jsx'
import { useTileSource } from '../data/useTileSource.js'
import { fetchTasks, mapTasks } from '../data/adapters/tasks.js'
import { fetchBookTasks, mapBookTasks } from '../data/adapters/book.js'
import { deriveCountdowns, formatCountdown, groupTasksByBusiness, summarizeBookLane } from './z2Projects.js'
import { useNow } from './useNow.js'

const TASKS_CADENCE_MS = 60000
const BOOK_CADENCE_MS = 900000

const STATUS_LABELS = Object.freeze({
  pending: 'pending',
  in_progress: 'in progress',
  blocked: 'blocked',
  done: 'done',
})

// ─── Shared tasks source (project cards + countdowns) ───────────────────────

async function projectTasksFetcher(signal) {
  const result = await fetchTasks(signal, { limit: 200 })
  if (!result.ok) return result
  const view = mapTasks(result.data)
  return { ...result, viewData: view, resolution: view.empty ? 'empty' : 'populated' }
}

function useSharedTasks() {
  return useTileSource({ fetcher: projectTasksFetcher, cadenceMs: TASKS_CADENCE_MS })
}

// ─── Project cards (hover lift only; display-only in C) ─────────────────────

function countsText(counts) {
  return Object.entries(STATUS_LABELS)
    .filter(([status]) => counts[status] > 0)
    .map(([status, label]) => `${counts[status]} ${label}`)
    .join(' · ')
}

export function Z2ProjectCards({ source }) {
  const { status, data, error, updatedAt, retry } = source
  const groups = useMemo(() => groupTasksByBusiness(data && data.tasks), [data])

  return (
    <Tile
      title="Projects"
      status={status}
      error={error}
      updatedAt={updatedAt}
      onRetry={retry}
      emptyCopy="No active projects."
      skeletonRows={3}
      className="v2-z2__projects"
    >
      <div className="v2-project-grid">
        {groups.map((group) => (
          <Card lift key={group.business} className="v2-project-card">
            <div className="v2-project-card__head">
              <strong>{group.business}</strong>
              <span className="v2-project-card__ratio">{group.done}/{group.total} done</span>
            </div>
            <ProgressBar
              value={group.percent}
              label={`${group.business} progress — ${group.done} of ${group.total} tasks done`}
            />
            <span className="v2-project-card__counts">{countsText(group.counts)}</span>
          </Card>
        ))}
      </div>
    </Tile>
  )
}

// ─── Book information (G1: task-based Book info ONLY — never claims a Book
//     system/base or BK_* read model exists; quiet-empty when no Book tasks) ──

async function bookInfoFetcher(signal) {
  const result = await fetchBookTasks(signal)
  if (!result.ok) return result
  const view = mapBookTasks(result.data)
  const info = summarizeBookLane(view.tasks)
  return { ...result, viewData: info, resolution: info.empty ? 'empty' : 'populated' }
}

export function Z2BookInfo() {
  const { status, data, error, updatedAt, retry } = useTileSource({
    fetcher: bookInfoFetcher,
    cadenceMs: BOOK_CADENCE_MS,
  })

  return (
    <Tile
      title="Book"
      status={status}
      error={error}
      updatedAt={updatedAt}
      onRetry={retry}
      emptyCopy="No Book tasks on the board."
      skeletonRows={2}
      className="v2-z2__book"
    >
      {data && (
        <div className="v2-book-info">
          <p className="v2-book-info__count">
            {data.count} Book {data.count === 1 ? 'task' : 'tasks'} on the board
          </p>
          <ul className="v2-book-info__list">
            {data.topTitles.map((item, index) => (
              <li key={item.id != null ? item.id : index}>{item.title}</li>
            ))}
          </ul>
        </div>
      )}
    </Tile>
  )
}

// ─── Countdowns (client-derived from due_date; recomputes on the 30s tick
//     or data refresh; quiet — renders nothing when nothing is dated) ────────

export function Z2Countdowns({ source }) {
  const { status, data } = source
  const now = useNow(30000)
  const countdowns = useMemo(
    () => deriveCountdowns(data && data.tasks, { now }),
    [data, now],
  )
  const hasContent = status === 'populated' || status === 'stale' || status === 'partial'
  if (!hasContent || countdowns.length === 0) return null

  return (
    <div className="v2-countdowns">
      <div className="v2-zone__label v2-countdowns__label"><span>Countdowns</span><i /></div>
      <ul className="v2-countdowns__list">
        {countdowns.map((item) => (
          <li className="v2-countdowns__row" key={item.id}>
            <span className="v2-countdowns__name">{item.label}</span>
            <span className="v2-countdowns__value">{formatCountdown(item.countdown)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Zone composition ───────────────────────────────────────────────────────

export default function Z2Projects() {
  const tasks = useSharedTasks()
  return (
    <div className="v2-zone__body v2-z2">
      <Z2ProjectCards source={tasks} />
      <Z2BookInfo />
      <Z2Countdowns source={tasks} />
      <Link className="v2-zone-link" to="/v2/work">Open Work →</Link>
    </div>
  )
}
