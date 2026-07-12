import { useEffect, useState } from 'react'
import './tokens.css'
import './gallery.css'
import { Button, Card, Chip, Kbd, Panel, ProgressBar, ProgressRing, Sparkline, StatCard, Toast } from './components/index.jsx'

const chipTones = ['info', 'good', 'warn', 'crit', 'ai', 'exec']

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
        <GalleryHeading id="buttons-title" title="Buttons" description="Default, hover simulation, keyboard focus, and disabled states." />
        <div className="v2-gallery__row">
          <Button>Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="ai">AI action</Button>
          <Button variant="danger">Danger</Button>
          <Button className="v2-gallery__forced-hover">Hover</Button>
          <Button className="v2-gallery__forced-focus">Focus</Button>
          <Button disabled>Disabled</Button>
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
