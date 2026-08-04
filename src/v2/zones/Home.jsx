// Home.jsx — MOSV2-C /v2/home composition (PLAN §7, §8, G10).
// Replaces the Phase A/B HomeSkeleton: all five zones render real zone
// components — Z1 (Today), Z2 (Projects), Z3 (Business), Z4 (Life), and Z5
// (Quick Actions, fixture-backed dispatch — see Z5QuickActions.jsx). Every
// zone is its own component wrapped in ZoneErrorBoundary — a crashing zone
// never takes the shell or siblings down. Zone labels are exactly: Today /
// Projects / Business / Life / Quick Actions (G10 relabels the old Z5 "Mya"
// heading).

import { ZoneErrorBoundary } from './Tile.jsx'
import Z1Today, { Z1Greeting } from './Z1Today.jsx'
import Z2Projects from './Z2Projects.jsx'
import Z3Business from './Z3Business.jsx'
import Z4Personal from './Z4Personal.jsx'
import Z5QuickActions from './Z5QuickActions.jsx'

const zones = [
  { order: 1, label: 'Today', name: 'Today', content: <Z1Today /> },
  { order: 2, label: 'Projects', name: 'Projects', content: <Z2Projects /> },
  { order: 3, label: 'Business', name: 'Business', content: <Z3Business /> },
  { order: 4, label: 'Life', name: 'Life', content: <Z4Personal /> },
  { order: 5, label: 'Quick Actions', name: 'Quick Actions', content: <Z5QuickActions /> },
]

export default function Home() {
  return (
    <section className="v2-home" aria-labelledby="v2-home-title">
      <Z1Greeting />
      <div className="v2-stage-grid">
        {zones.map((zone, index) => (
          <section className={`v2-zone v2-zone--${zone.order}`} key={zone.label} style={{ '--zone-order': index }} aria-labelledby={`v2-zone-label-${zone.order}`}>
            <div className="v2-zone__label"><span id={`v2-zone-label-${zone.order}`}>{zone.label}</span><i /></div>
            <ZoneErrorBoundary zone={zone.name}>{zone.content}</ZoneErrorBoundary>
          </section>
        ))}
      </div>
    </section>
  )
}
