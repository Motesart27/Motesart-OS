import { useEffect, useState } from 'react'
import './tokens.css'
import './gallery.css'
import { Button, Card, Chip, Kbd, Panel, ProgressBar, ProgressRing, Sparkline, StatCard, Toast } from './components/index.jsx'
import { MyaBar, PaletteShell, RailNav, Stage, TopBar } from './shell/index.jsx'

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
          <p className="v2-gallery__eyebrow">Graphite Design System · Phase A</p>
          <h1>Foundation gallery</h1>
          <p className="v2-gallery__lede">The production primitives for Motes OS v2, shown together as a permanent visual regression surface.</p>
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
