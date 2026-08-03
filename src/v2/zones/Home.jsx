// Home.jsx — MOSV2-C /v2/home composition (PLAN §7, §8, G10).
// Replaces the Phase A/B HomeSkeleton: Z1 (Today), Z2 (Projects), Z3
// (Business), and Z4 (Life) render real zone components; Z5 keeps the
// skeleton placeholder markup until its stage lands. Every zone is its own
// component wrapped in ZoneErrorBoundary — a crashing zone never takes the
// shell or siblings down. Zone labels are exactly: Today / Projects /
// Business / Life / Quick Actions (G10 relabels the old Z5 "Mya" heading).

import { ZoneErrorBoundary } from './Tile.jsx'
import Z1Today, { Z1Greeting } from './Z1Today.jsx'
import Z2Projects from './Z2Projects.jsx'
import Z3Business from './Z3Business.jsx'
import Z4Personal from './Z4Personal.jsx'

// Placeholder for zones whose stage has not landed yet (Z5 in C).
function ZoneSkeleton({ title }) {
  return (
    <>
      <h2>{title}</h2>
      <div className="v2-skeleton-lines" aria-hidden="true"><i /><i /><i /></div>
    </>
  )
}

const zones = [
  { order: 1, label: 'Today', name: 'Today', content: <Z1Today /> },
  { order: 2, label: 'Projects', name: 'Projects', content: <Z2Projects /> },
  { order: 3, label: 'Business', name: 'Business', content: <Z3Business /> },
  { order: 4, label: 'Life', name: 'Life', content: <Z4Personal /> },
  { order: 5, label: 'Quick Actions', name: 'Quick Actions', content: <ZoneSkeleton title="Quiet intelligence" /> },
]

export default function Home() {
  return (
    <section className="v2-home" aria-labelledby="v2-home-title">
      <Z1Greeting />
      <div className="v2-stage-grid">
        {zones.map((zone, index) => (
          <section className={`v2-zone v2-zone--${zone.order}`} key={zone.label} style={{ '--zone-order': index }}>
            <div className="v2-zone__label"><span>{zone.label}</span><i /></div>
            <ZoneErrorBoundary zone={zone.name}>{zone.content}</ZoneErrorBoundary>
          </section>
        ))}
      </div>
    </section>
  )
}
