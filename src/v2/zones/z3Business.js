// z3Business.js — Z3 Business derivation + revenue-chart geometry (PLAN §8 Z3,
// §9.1, §10, rulings G2/G4/§3.8). Pure and dependency-free: no fetch, no
// timers, no React.
//
// Source law for this zone:
//   · Pulse — LIVE candidate via the tasks adapter (/api/pulse); buckets are
//     ARRAYS of task objects, the tile counts lengths (adapters/tasks.js).
//   · FM stats — UNAVAILABLE_LIVE pre-B2 (§3.8): the formatters below exist
//     for the FIXTURE-fed Gallery demonstrations only; nothing here can make
//     an FM value reach a live populated surface.
//   · Revenue chart — FIXTURE-only (G4): geometry consumes hand-written daily
//     fixture points verbatim. There is no resampling, interpolation,
//     duplication, or monthly-as-daily path anywhere in this module.
//   · SOM count — DEFERRED (G2): no som adapter exists; nothing here fetches.

// ─── Pulse tile ─────────────────────────────────────────────────────────────

// Display rows in the plan's field order (§8 Z3). Tone is a Chip token name;
// the label text always accompanies it — severity is never color-alone.
export const PULSE_ROWS = Object.freeze([
  { key: 'urgent', label: 'Urgent', tone: 'crit' },
  { key: 'overdue', label: 'Overdue', tone: 'warn' },
  { key: 'blocked', label: 'Blocked', tone: 'warn' },
  { key: 'approval', label: 'Needs approval', tone: 'exec' },
  { key: 'done_today', label: 'Done today', tone: 'good' },
  { key: 'stale', label: 'Stale', tone: 'info' },
])

// mapPulse counts → ordered display rows. Missing/non-numeric buckets render
// as 0 — a bucket never disappears and never crashes the tile.
export function pulseRows(counts) {
  const source = counts && typeof counts === 'object' ? counts : {}
  return PULSE_ROWS.map((row) => {
    const count = source[row.key]
    return { ...row, count: Number.isFinite(count) && count >= 0 ? count : 0 }
  })
}

// ─── FM stat tiles (§3.8 pre-B2: FIXTURE demonstration path only) ───────────

export const FM_STAT_FIELDS = Object.freeze([
  { key: 'income', label: 'Income YTD' },
  { key: 'expenses', label: 'Expenses YTD' },
  { key: 'net', label: 'Net YTD' },
])

// Tabular money label ("$48,240"). Absent/non-finite → null so the renderer
// emits the §8 partial-state em-dash — never a blank, never a guessed value.
export function formatMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return `$${Math.round(value).toLocaleString('en-US')}`
}

// ytd payload → ordered stat views; each absent field keeps its label with a
// null value (em-dash per absent field, §8 post-B2 partial rule).
export function fmStatViews(ytd) {
  const source = ytd && typeof ytd === 'object' ? ytd : {}
  return FM_STAT_FIELDS.map((field) => ({ ...field, value: formatMoney(source[field.key]) }))
}

// ─── Revenue chart (G4: FIXTURE-only component geometry) ────────────────────

export const REVENUE_RANGES = Object.freeze(['7D', '30D', 'QTD'])

// "Aug 2" from a fixture date. Fixture dates are bare calendar dates — parsed
// as local midnight, never UTC, so the rendered day is the recorded day.
export function formatChartDate(date) {
  if (!date) return '—'
  const parsed = new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00` : date)
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed)
}

// Per-step keyboard-crosshair announcement (9.1): "‹date› — ‹value›".
export function crosshairAnnouncement(point) {
  if (!point || typeof point !== 'object') return ''
  const value = formatMoney(point.value)
  return `${formatChartDate(point.date)} — ${value == null ? '—' : value}`
}

// Arrow/Home/End stepping for the keyboard crosshair (9.1): Left/Right step
// one point clamped at the ends; Home/End jump to the endpoints.
export function crosshairIndex(current, key, length) {
  if (!Number.isFinite(length) || length <= 0) return -1
  const last = length - 1
  const base = Number.isFinite(current) ? current : 0
  switch (key) {
    case 'ArrowLeft':
      return Math.max(0, base - 1)
    case 'ArrowRight':
      return Math.min(last, base + 1)
    case 'Home':
      return 0
    case 'End':
      return last
    default:
      return Math.min(Math.max(base, 0), last)
  }
}

// Pointer-crosshair lookup: index of the plotted coordinate nearest to an
// x position in chart space. Empty input → -1 (no crosshair).
export function nearestPointIndex(coords, x) {
  const list = Array.isArray(coords) ? coords : []
  if (list.length === 0 || !Number.isFinite(x)) return -1
  let nearest = 0
  for (let index = 1; index < list.length; index += 1) {
    if (Math.abs(list[index].x - x) < Math.abs(list[nearest].x - x)) nearest = index
  }
  return nearest
}

const round2 = (n) => Math.round(n * 100) / 100

// Hand-rolled area-chart geometry from verbatim daily points. Scale
// truthfulness (§8): the y domain is anchored at ZERO — area height is
// proportional to absolute value, never truncated to dramatize movement; the
// caller renders the domain labels from the returned `max`. Points are used
// exactly as given: no interpolation, no subdivision, no resampling (G4).
// Returns null for absent/empty series so the tile renders its quiet state.
export function chartGeometry(points, { width = 320, height = 120, padX = 4, padY = 8 } = {}) {
  const list = Array.isArray(points)
    ? points.filter((p) => p && typeof p === 'object' && Number.isFinite(p.value))
    : []
  if (list.length === 0) return null

  const max = Math.max(...list.map((p) => p.value), 0)
  const innerW = Math.max(width - padX * 2, 1)
  const innerH = Math.max(height - padY * 2, 1)
  const step = list.length > 1 ? innerW / (list.length - 1) : 0
  const baseline = padY + innerH

  const coords = list.map((point, index) => ({
    x: round2(list.length > 1 ? padX + step * index : padX + innerW / 2),
    y: round2(max === 0 ? baseline : baseline - (point.value / max) * innerH),
    point,
  }))

  const linePath = coords
    .map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x},${coord.y}`)
    .join(' ')
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${baseline} L${coords[0].x},${baseline} Z`

  return { coords, linePath, areaPath, baseline: round2(baseline), max, width, height }
}
