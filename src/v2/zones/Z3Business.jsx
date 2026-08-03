// Z3Business.jsx — Z3 Business zone (PLAN §8 Z3, §9, §10; rulings G2, G4, §3.8).
// Tiles: Z3Pulse (LIVE candidate, /api/pulse via the tasks adapter, 60s) ·
// Z3FMStats (UNAVAILABLE_LIVE pre-B2 — deterministic b2-pending, no fetch) ·
// Z3RevenueChart (FIXTURE-only interactive component; the LIVE cockpit tile is
// the ruled unavailability quiet line — G4) · Z3SOMCount (DEFERRED quiet-empty,
// no som adapter — G2). All display-only; the *View exports are the
// FIXTURE-fed Gallery demonstration renderers, never live surfaces.

import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Chip } from '../components/index.jsx'
import { Tile, TileValue } from './Tile.jsx'
import { useTileSource } from '../data/useTileSource.js'
import { fetchPulse, mapPulse } from '../data/adapters/tasks.js'
import { DATA_CLASSIFICATION } from '../data/tileMachine.js'
import {
  REVENUE_RANGES,
  chartGeometry,
  crosshairAnnouncement,
  crosshairIndex,
  fmStatViews,
  formatChartDate,
  formatMoney,
  nearestPointIndex,
  pulseRows,
} from './z3Business.js'

const PULSE_CADENCE_MS = 60000
const RANGE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End'])

// ─── Business pulse (LIVE candidate; production-trusted source, 60s cadence) ─

async function pulseFetcher(signal) {
  const result = await fetchPulse(signal)
  if (!result.ok) return result
  const view = mapPulse(result.data)
  return { ...result, viewData: view, resolution: view.empty ? 'empty' : 'populated' }
}

export function Z3Pulse() {
  const { status, data, error, updatedAt, retry } = useTileSource({
    fetcher: pulseFetcher,
    cadenceMs: PULSE_CADENCE_MS,
  })
  const rows = useMemo(() => pulseRows(data && data.counts), [data])

  return (
    <Tile
      title="Business pulse"
      status={status}
      error={error}
      updatedAt={updatedAt}
      onRetry={retry}
      skeletonRows={3}
      className="v2-z3__pulse"
    >
      <ul className="v2-pulse-list">
        {rows.map((row) => (
          <li className="v2-pulse-row" key={row.key}>
            <Chip tone={row.tone}>{row.label}</Chip>
            <span className="v2-pulse-row__count">{row.count}</span>
          </li>
        ))}
      </ul>
    </Tile>
  )
}

// ─── FM stat tiles (§3.8 pre-B2: deterministic b2-pending, entered without
//     any fetch — fail-closed; no FM value renders live) ─────────────────────

// FIXTURE demonstration renderer (Gallery only): stat label + tabular value,
// em-dash per absent field (§8 partial rule).
export function Z3FMStatsView({ ytd }) {
  return (
    <div className="v2-fm-stats">
      {fmStatViews(ytd).map((stat) => (
        <div className="v2-fm-stat" key={stat.key}>
          <span className="v2-fm-stat__label">{stat.label}</span>
          <strong className="v2-fm-stat__value"><TileValue value={stat.value} /></strong>
        </div>
      ))}
    </div>
  )
}

export function Z3FMStats() {
  const { status } = useTileSource({
    enabled: false,
    initialClassification: DATA_CLASSIFICATION.UNAVAILABLE_LIVE,
  })
  return (
    <Tile
      title="Financial summary"
      status={status}
      unavailableCopy="Financial data unavailable — verification pending."
      skeletonRows={2}
      className="v2-z3__fm"
    />
  )
}

// ─── SOM student count (G2 DEFERRED: quiet-empty, no fetch, no som adapter) ──

// FIXTURE demonstration renderer (Gallery only): the eventual populated state.
export function Z3SOMCountView({ activeStudents }) {
  return (
    <p className="v2-som-count">
      <strong className="v2-som-count__value"><TileValue value={activeStudents} /></strong>
      <span className="v2-som-count__label">active students</span>
    </p>
  )
}

export function Z3SOMCount() {
  const { status } = useTileSource({
    enabled: false,
    initialClassification: DATA_CLASSIFICATION.DEFERRED,
  })
  return (
    <Tile
      title="SOM students"
      status={status}
      emptyCopy="SOM data connection pending."
      skeletonRows={1}
      className="v2-z3__som"
    />
  )
}

// ─── Revenue chart (G4 FIXTURE-only component; the live cockpit tile below it
//     is the ruled unavailability display, not an interactive plot) ──────────

// Interactive area chart driven entirely by deterministic fixture series:
// range tablist (roving focus; arrows move, Enter/Space select), hand-rolled
// SVG with draw-in on mount + range change only, pointer crosshair + tooltip,
// and the 9.1 keyboard crosshair (plot tabindex=0, role="img", arrows step,
// Home/End endpoints, Esc blurs, polite per-step "‹date› — ‹value›").
export function Z3RevenueChart({ seriesByRange, label = null }) {
  const [range, setRange] = useState(REVENUE_RANGES[0])
  const [hoverIndex, setHoverIndex] = useState(null)
  const [focusIndex, setFocusIndex] = useState(null)
  const plotRef = useRef(null)
  const tabRefs = useRef([])

  const series = seriesByRange ? seriesByRange[range] : null
  const points = useMemo(
    () => (series && Array.isArray(series.points) ? series.points : []),
    [series],
  )
  const geometry = useMemo(() => chartGeometry(points), [points])
  const activeIndex = hoverIndex != null ? hoverIndex : focusIndex
  const active = geometry && activeIndex != null ? geometry.coords[activeIndex] : null

  const selectRange = (name) => {
    setRange(name)
    setHoverIndex(null)
    setFocusIndex(null)
  }

  // Roving focus across the tablist: Left/Right (and Home/End) move focus
  // only; Enter/Space select via the focused button's native click (§10).
  const onRangeKeyDown = (event) => {
    if (!RANGE_KEYS.has(event.key)) return
    event.preventDefault()
    const current = tabRefs.current.findIndex((el) => el === event.target)
    if (current === -1) return
    const next = tabRefs.current[crosshairIndex(current, event.key, REVENUE_RANGES.length)]
    if (next) next.focus()
  }

  const onPlotKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.currentTarget.blur()
      return
    }
    if (!geometry || !RANGE_KEYS.has(event.key)) return
    event.preventDefault()
    setFocusIndex((current) => {
      if (current == null) return event.key === 'ArrowLeft' ? geometry.coords.length - 1 : 0
      return crosshairIndex(current, event.key, geometry.coords.length)
    })
  }

  const onPlotMouseMove = (event) => {
    if (!geometry || !plotRef.current) return
    const rect = plotRef.current.getBoundingClientRect()
    if (rect.width <= 0) return
    const x = ((event.clientX - rect.left) / rect.width) * geometry.width
    setHoverIndex(nearestPointIndex(geometry.coords, x))
  }

  return (
    <div className="v2-chart">
      <div className="v2-chart__head">
        <div
          className="v2-chart__ranges"
          role="tablist"
          aria-label="Revenue range"
          onKeyDown={onRangeKeyDown}
        >
          {REVENUE_RANGES.map((name, index) => (
            <button
              key={name}
              ref={(el) => { tabRefs.current[index] = el }}
              type="button"
              role="tab"
              aria-selected={range === name}
              tabIndex={range === name ? 0 : -1}
              className={`v2-chart__range${range === name ? ' is-active' : ''}`}
              onClick={() => selectRange(name)}
            >
              {name}
            </button>
          ))}
        </div>
        {label && <span className="v2-chart__fixture">{label}</span>}
      </div>
      <span role="status" className="v2-tile__sr">
        {geometry && focusIndex != null ? crosshairAnnouncement(geometry.coords[focusIndex].point) : ''}
      </span>
      {geometry && (
        <div
          ref={plotRef}
          className="v2-chart__plot"
          role="img"
          tabIndex={0}
          aria-label={`Revenue trend, ${range} range, ${points.length} daily points${label ? ', fixture data' : ''}`}
          onKeyDown={onPlotKeyDown}
          onMouseMove={onPlotMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <svg
            className="v2-chart__svg"
            viewBox={`0 0 ${geometry.width} ${geometry.height}`}
            aria-hidden="true"
          >
            <line
              className="v2-chart__baseline"
              x1={0}
              x2={geometry.width}
              y1={geometry.baseline}
              y2={geometry.baseline}
            />
            {/* key={range}: draw-in replays on mount + range change only (DB-C7/D5) */}
            <g key={range}>
              <path className="v2-chart__area" d={geometry.areaPath} />
              <path className="v2-chart__line" d={geometry.linePath} pathLength="1" />
            </g>
            {active && (
              <g className="v2-chart__crosshair">
                <line x1={active.x} x2={active.x} y1={active.y} y2={geometry.baseline} />
                <circle cx={active.x} cy={active.y} r="3" />
              </g>
            )}
          </svg>
          <span className="v2-chart__scale v2-chart__scale--max">{formatMoney(geometry.max)}</span>
          <span className="v2-chart__scale v2-chart__scale--min">{formatMoney(0)}</span>
          {active && (
            <div
              className="v2-chart__tooltip"
              style={{
                left: `${(active.x / geometry.width) * 100}%`,
                top: `${(active.y / geometry.height) * 100}%`,
              }}
            >
              <span className="v2-chart__tooltip-date">{formatChartDate(active.point.date)}</span>
              <strong className="v2-chart__tooltip-value">{formatMoney(active.point.value)}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Live cockpit revenue tile (G4): explicit unavailability quiet line, entered
// without any fetch. B2 approval does not change this tile (§3.8).
export function Z3RevenueUnavailable() {
  const { status } = useTileSource({
    enabled: false,
    initialClassification: DATA_CLASSIFICATION.DEFERRED,
  })
  return (
    <Tile
      title="Revenue trend"
      status={status}
      emptyCopy="Revenue trend unavailable — daily source not connected."
      skeletonRows={3}
      className="v2-z3__revenue"
    />
  )
}

// ─── Zone composition ───────────────────────────────────────────────────────

export default function Z3Business() {
  return (
    <div className="v2-zone__body v2-z3">
      <Z3Pulse />
      <Z3RevenueUnavailable />
      <Z3FMStats />
      <Z3SOMCount />
      <Link className="v2-zone-link" to="/v2/money">Open Money →</Link>
    </div>
  )
}
