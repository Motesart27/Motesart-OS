import { useEffect, useState } from 'react'
import './tokens.css'
import './gallery.css'
import { Button, Card, Chip, Kbd, Panel, ProgressBar, ProgressRing, Sparkline, StatCard, Toast } from './components/index.jsx'
import { MyaBar, PaletteShell, RailNav, Stage, TopBar } from './shell/index.jsx'
import { Tile } from './zones/Tile.jsx'
import { Z3FMStatsView, Z3RevenueChart, Z3SOMCountView } from './zones/Z3Business.jsx'
import { FIXTURE_LABEL, fixtureTileStates } from './data/fixtures.js'
import { TILE_STATUS, rankSignals } from './data/tileMachine.js'
import { mapDispatchResponse, mapDispatchResult } from './data/adapters/dispatch.js'
import { QUICK_ACTIONS, dispatchToast } from './zones/z5QuickActions.js'
import { SIGNAL_SEVERITY_LABELS } from './zones/z1Signals.js'
import { formatEventTime } from './zones/z1Agenda.js'
import { groupTasksByBusiness, summarizeBookLane } from './zones/z2Projects.js'
import { pulseRows } from './zones/z3Business.js'

const chipTones = ['info', 'good', 'warn', 'crit', 'ai', 'exec']
const buttonVariants = [
  { label: 'Primary', variant: 'pri' },
  { label: 'Ghost', variant: 'ghost' },
  { label: 'AI action', variant: 'ai' },
  { label: 'Danger', variant: 'danger' },
]
const railPreviewStates = [
  ['default', 'Collapsed · default'],
  ['hover', 'Collapsed · forced hover'],
  ['focus', 'Collapsed · forced keyboard focus'],
  ['active', 'Collapsed · active beacon'],
  ['expanded', 'Expanded · default'],
  ['expanded-focus', 'Expanded · forced hover/focus-within'],
]
const topBarPreviewStates = [
  [{}, 'Search · default · focus inactive/active · EXEC default · bell badge'],
  [{ searchState: 'hover' }, 'Search · forced hover'],
  [{ searchState: 'focus' }, 'Search · forced keyboard focus'],
  [{ execState: 'hover' }, 'EXEC · forced hover'],
  [{ execState: 'focus' }, 'EXEC · forced keyboard focus'],
  [{ execState: 'active' }, 'EXEC · stub-active'],
]
const myaBarPreviewStates = [
  ['default', 'Default'],
  ['hover', 'Forced hover'],
  ['focus', 'Forced keyboard focus'],
]

export default function Gallery() {
  const [toastVisible, setToastVisible] = useState(false)

  useEffect(() => {
    if (!toastVisible) return undefined
    const timer = window.setTimeout(() => setToastVisible(false), 3000)
    return () => window.clearTimeout(timer)
  }, [toastVisible])

  return (
    <main className="v2-gallery">
      <header className="v2-gallery__hero">
        <div>
          <p className="v2-gallery__eyebrow">Graphite Design System · Phases A–C</p>
          <h1>Foundation gallery</h1>
          <p className="v2-gallery__lede">The production primitives for Motes OS v2, shown together as a permanent visual regression surface — now including the Phase C specimen harness: every fixture tile state mounted through the production Tile renderer.</p>
        </div>
        <Chip tone="good">MOS_V2 enabled</Chip>
      </header>

      <Panel aria-labelledby="buttons-title">
        <GalleryHeading id="buttons-title" title="Buttons" description="Every production variant across default, hover, keyboard focus, and native disabled states." />
        <div className="v2-gallery__button-matrix" role="group" aria-labelledby="buttons-title">
          <span className="v2-gallery__matrix-corner" aria-hidden="true">Variant</span>
          <span className="v2-gallery__matrix-heading">Default</span>
          <span className="v2-gallery__matrix-heading">Hover</span>
          <span className="v2-gallery__matrix-heading">Keyboard focus</span>
          <span className="v2-gallery__matrix-heading">Disabled</span>
          {buttonVariants.map(({ label, variant }) => (
            <div className="v2-gallery__button-row" key={variant}>
              <strong className="v2-gallery__matrix-label">{label}</strong>
              <div className="v2-gallery__matrix-cell"><Button variant={variant} aria-label={`${label}, default`}>{label}</Button></div>
              <div className="v2-gallery__matrix-cell"><Button variant={variant} className="v2-gallery__forced-hover" aria-label={`${label}, simulated hover`}>{label}</Button></div>
              <div className="v2-gallery__matrix-cell"><Button variant={variant} className="v2-gallery__forced-focus" aria-label={`${label}, simulated keyboard focus`}>{label}</Button></div>
              <div className="v2-gallery__matrix-cell"><Button variant={variant} disabled aria-label={`${label}, disabled`}>{label}</Button></div>
            </div>
          ))}
        </div>
      </Panel>

      <section className="v2-gallery__grid" aria-label="Surface components">
        <Card lift>
          <p className="v2-gallery__eyebrow">Opaque surface</p>
          <h2>Liftable card</h2>
          <p>Hover to see the restrained rise, tilt, border brightening, and shadow bloom.</p>
        </Card>
        <Panel>
          <p className="v2-gallery__eyebrow">Glass surface</p>
          <h2>Panel</h2>
          <p>Panels brighten without lifting and hold zone-level content.</p>
        </Panel>
      </section>

      <Panel aria-labelledby="chips-title">
        <GalleryHeading id="chips-title" title="Signal chips" description="Every lawful accent pairing: dim fill plus accessible text tier." />
        <div className="v2-gallery__row">
          {chipTones.map((tone) => <Chip key={tone} tone={tone}>{tone} · 3</Chip>)}
        </div>
      </Panel>

      <Panel aria-labelledby="stats-title">
        <GalleryHeading id="stats-title" title="Stats and trends" description="Tabular values, textual deltas, and one-time SVG draw-in." />
        <div className="v2-gallery__stats">
          <StatCard label="Revenue" value="$48,240" delta="↑ 12.4%">
            <Sparkline values={[12, 14, 13, 18, 17, 22, 26]} label="Revenue increased 12.4 percent" />
          </StatCard>
          <StatCard label="Overdue" value="3" delta="↓ 2 this week" deltaDirection="down">
            <Sparkline values={[9, 8, 8, 6, 5, 4, 3]} label="Overdue count declined to 3" tone="good" />
          </StatCard>
          <StatCard label="Students" value="24" delta="Live status · stable" />
        </div>
      </Panel>

      <section className="v2-gallery__grid" aria-label="Progress components">
        <Card>
          <GalleryHeading title="Progress bar" description="1.4s locked fill and glow standard." />
          <div className="v2-gallery__progress-label"><span>Foundation</span><strong>72%</strong></div>
          <ProgressBar value={72} label="Foundation progress: 72 percent" />
        </Card>
        <Card>
          <GalleryHeading title="Progress ring" description="Hand-rolled SVG with text grounding." />
          <ProgressRing value={82} label="Foundation completion" />
        </Card>
      </section>

      <Panel aria-labelledby="feedback-title">
        <GalleryHeading id="feedback-title" title="Feedback and keyboard" description="Polite live-region toast plus the system keyboard treatment." />
        <div className="v2-gallery__row">
          <Button variant="ai" onClick={() => setToastVisible(true)}>Show toast</Button>
          <span className="v2-gallery__shortcut"><Kbd>Tab</Kbd> focus <Kbd>Enter</Kbd> activate</span>
        </div>
      </Panel>

      <Panel aria-labelledby="shell-title">
        <GalleryHeading id="shell-title" title="Phase B shell" description="The persistent cockpit frame across collapsed, expanded, modal, and workspace states." />
        <div className="v2-gallery__shell-rails">
          {railPreviewStates.map(([state, label]) => <figure key={state}><RailNav preview previewState={state} /><figcaption>{label}</figcaption></figure>)}
        </div>
      </Panel>

      <Panel aria-labelledby="topbar-title">
        <GalleryHeading id="topbar-title" title="Top bar" description="Deterministic search, focus-switcher, EXEC, and quiet notification states." />
        <div className="v2-gallery__topbar-states">
          {topBarPreviewStates.map(([props, label]) => <figure key={label}><TopBar preview {...props} /><figcaption>{label}</figcaption></figure>)}
        </div>
      </Panel>

      <section className="v2-gallery__grid" aria-label="Mya shell components">
        <Card>
          <GalleryHeading title="MyaBar" description="Default, forced-hover, and forced-focus cockpit prompt states." />
          <div className="v2-gallery__mya-states">
            {myaBarPreviewStates.map(([state, label]) => <figure key={state}><div className="v2-gallery__mya-specimen"><MyaBar preview previewState={state} /></div><figcaption>{label}</figcaption></figure>)}
          </div>
        </Card>
        <Card>
          <GalleryHeading title="L2 workspace" description="Header, KPI strip, worklist, and context-rail skeleton." />
          <div className="v2-gallery__workspace-thumb"><Stage module="work" preview /></div>
        </Card>
      </section>

      <Panel aria-labelledby="palette-title">
        <GalleryHeading id="palette-title" title="Command palette shell" description="Open modal state only; search, actions, and voice behavior remain excluded." />
        <PaletteShell preview />
      </Panel>

      <Panel aria-labelledby="phase-c-title">
        <GalleryHeading
          id="phase-c-title"
          title="Phase C specimen harness"
          description={`Every specimen from src/v2/data/fixtures.js mounted through the production Tile renderer: all fixtureTileStates states (loading / populated / empty / partial / stale / error / permission-denied / offline / b2-pending) for all twelve tiles, the §3.6 mock rejection, and the Z5 dispatch outcomes. ${FIXTURE_LABEL}.`}
        />
        {SPECIMEN_GROUPS.map(({ key, title }) => (
          <section className="v2-gallery__specimen-group" key={key} aria-label={title}>
            <h3>{title}</h3>
            <div className="v2-gallery__specimen-grid">
              {Object.entries(fixtureTileStates[key]).map(([stateName, specimen]) => (
                <SpecimenTile key={stateName} tileKey={key} title={title} stateName={stateName} specimen={specimen} />
              ))}
            </div>
          </section>
        ))}
        <section className="v2-gallery__specimen-group" aria-label="Mock rejection and dispatch outcomes">
          <h3>§3.6 mock rejection · Z5 dispatch outcomes</h3>
          <div className="v2-gallery__specimen-grid">
            <figure className="v2-gallery__specimen" data-specimen="z3FmMockRejection" data-specimen-state="error">
              <Tile
                title="Z3 · Financial summary"
                status={TILE_STATUS.ERROR}
                error={fixtureTileStates.z3FmMockRejection.resultingState.error}
                onRetry={noopRetry}
              />
              <figcaption><Chip tone="info">FIXTURE</Chip> a &quot;status&quot;:&quot;mock&quot; payload enters error, never populated (§3.6)</figcaption>
            </figure>
          </div>
          <div className="v2-gallery__dispatch-specimens" data-specimen="z5Dispatch">
            {DISPATCH_SPECIMENS.map(({ name, outcome }) => {
              const toast = dispatchToast(outcome, QUICK_ACTIONS[0])
              return (
                <span className="v2-gallery__dispatch-specimen" data-specimen-state={name} key={name}>
                  <Chip tone={toast.tone}>{name}</Chip>
                  <span>{toast.copy}</span>
                </span>
              )
            })}
          </div>
          <p className="v2-gallery__specimen-note">Z5 dispatch outcomes — exactly one toast per dispatch; failure is the ruled crit line with zero auto-retries (§10). Injection proof: tests/mosv2-c/z5-dispatch-injection.test.js.</p>
        </section>
      </Panel>

      <Toast visible={toastVisible}>Foundation proof recorded.</Toast>
    </main>
  )
}

function GalleryHeading({ id, title, description }) {
  return (
    <div className="v2-gallery__heading">
      <h2 id={id}>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

// ─── Phase C specimen harness (§12.8) ────────────────────────────────────────
// Every fixtureTileStates state set rendered through the production Tile
// component with FIXTURE-only bodies. Zero network by construction — the
// fixtures module never imports anything that touches network, and these
// renderers are pure presentations of it. The DOM proof lives in
// tests/mosv2-c/gallery.test.js (mounts every fixture state, zero console
// errors); the browser proof is the harness gallery scenario.

const noopRetry = () => {}

const SPECIMEN_GROUPS = Object.freeze([
  { key: 'z1Signals', title: 'Z1 · Signals' },
  { key: 'z1Agenda', title: 'Z1 · Today agenda' },
  { key: 'z1HandledLog', title: 'Z1 · Handled log' },
  { key: 'z2Projects', title: 'Z2 · Projects' },
  { key: 'z2Book', title: 'Z2 · Book' },
  { key: 'z2Countdowns', title: 'Z2 · Countdowns' },
  { key: 'z3RevenueChart', title: 'Z3 · Revenue trend' },
  { key: 'z3FmStats', title: 'Z3 · Financial summary' },
  { key: 'z3Pulse', title: 'Z3 · Business pulse' },
  { key: 'z3SomCount', title: 'Z3 · SOM students' },
  { key: 'z4PersonalTasks', title: 'Z4 · Personal tasks' },
  { key: 'z4PersonalCalendar', title: 'Z4 · Personal calendar' },
])

const DISPATCH_SPECIMENS = Object.freeze([
  { name: 'success', outcome: mapDispatchResponse(fixtureTileStates.z5Dispatch.success) },
  { name: 'deduped', outcome: mapDispatchResponse(fixtureTileStates.z5Dispatch.deduped) },
  { name: 'failure', outcome: mapDispatchResult(fixtureTileStates.z5Dispatch.failure) },
])

// States that render the tile body content (stale/offline keep last-good
// content on screen — the §9 fallback law).
const CONTENT_STATES = new Set(['populated', 'partial', 'stale', 'offline'])
const RETRY_STATES = new Set(['error', 'permission-denied', 'offline'])

function SpecimenTile({ tileKey, title, stateName, specimen }) {
  const hasContent = specimen.data != null && CONTENT_STATES.has(stateName)
  return (
    <figure className="v2-gallery__specimen" data-specimen={tileKey} data-specimen-state={stateName}>
      <Tile
        title={title}
        status={stateName}
        error={specimen.error}
        updatedAt={specimen.updatedAt}
        emptyCopy={specimen.copy ?? undefined}
        unavailableCopy={specimen.copy ?? undefined}
        onRetry={RETRY_STATES.has(stateName) ? noopRetry : undefined}
      >
        {hasContent ? <SpecimenBody tileKey={tileKey} data={specimen.data} /> : null}
      </Tile>
      <figcaption><Chip tone="info">FIXTURE</Chip> {title} · {stateName}</figcaption>
    </figure>
  )
}

// FIXTURE body per tile: the same view models the live tiles derive, fed by
// the frozen fixture payloads (and the three Z3 FIXTURE demonstration views).
function SpecimenBody({ tileKey, data }) {
  switch (tileKey) {
    case 'z1Signals':
      return (
        <ul className="v2-gallery__specimen-list">
          {rankSignals(data.signals).map((signal) => (
            <li key={signal.id}><Chip tone={signal.severity}>{SIGNAL_SEVERITY_LABELS[signal.severity] || signal.severity}</Chip> {signal.summary}</li>
          ))}
        </ul>
      )
    case 'z1Agenda':
    case 'z4PersonalCalendar':
      return (
        <ul className="v2-gallery__specimen-list">
          {data.events.map((event, index) => (
            <li key={`${event.start}-${index}`}><strong>{formatEventTime(event.start)}</strong> {event.title}</li>
          ))}
        </ul>
      )
    case 'z1HandledLog': {
      const latest = data.items[0] ?? null
      return latest
        ? <p className="v2-gallery__specimen-list">Handled quietly: {latest.result_summary ?? latest.response_text}</p>
        : null
    }
    case 'z2Projects':
      return (
        <ul className="v2-gallery__specimen-list">
          {groupTasksByBusiness(data.tasks).map((group) => (
            <li key={group.business}><strong>{group.business}</strong> · {group.done}/{group.total} done</li>
          ))}
        </ul>
      )
    case 'z2Book': {
      const info = summarizeBookLane(data.tasks)
      return (
        <ul className="v2-gallery__specimen-list">
          <li><strong>{info.count} Book {info.count === 1 ? 'task' : 'tasks'}</strong> on the board</li>
          {info.topTitles.map((item, index) => <li key={item.id != null ? item.id : index}>{item.title}</li>)}
        </ul>
      )
    }
    case 'z2Countdowns':
      // Frozen-clock derivation: `expected` is the fixture's recorded
      // countdown at FIXTURE_NOW_ISO, so the gallery never drifts with the
      // wall clock.
      return (
        <ul className="v2-gallery__specimen-list">
          {data.countdowns.map((item) => (
            <li key={item.id}>{item.label} <strong>{item.expected.days}d {item.expected.hours}h</strong></li>
          ))}
        </ul>
      )
    case 'z3RevenueChart':
      return <Z3RevenueChart seriesByRange={data} label="FIXTURE" />
    case 'z3FmStats':
      return <Z3FMStatsView ytd={data.ytd} />
    case 'z3Pulse': {
      const counts = Object.fromEntries(
        Object.entries(data.pulse).map(([bucket, tasks]) => [bucket, Array.isArray(tasks) ? tasks.length : 0]),
      )
      return (
        <ul className="v2-gallery__specimen-list">
          {pulseRows(counts).map((row) => (
            <li key={row.key}><Chip tone={row.tone}>{row.label}</Chip> {row.count}</li>
          ))}
        </ul>
      )
    }
    case 'z3SomCount':
      return <Z3SOMCountView activeStudents={data.activeStudents} />
    case 'z4PersonalTasks':
      return (
        <ul className="v2-gallery__specimen-list">
          {data.tasks.map((task, index) => (
            <li key={task.id != null ? task.id : index}>{task.title}{task.due_date ? ` · due ${task.due_date}` : ''}</li>
          ))}
        </ul>
      )
    default:
      return null
  }
}
