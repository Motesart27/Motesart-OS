import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import './components.css'

export function Button({ variant = 'pri', children, className = '', ...props }) {
  return <button className={`v2-button v2-button--${variant} ${className}`} {...props}>{children}</button>
}

export function Card({ children, lift = false, className = '', ...props }) {
  return <div className={`v2-card${lift ? ' v2-card--lift' : ''} ${className}`} {...props}>{children}</div>
}

export function Panel({ children, className = '', ...props }) {
  return <section className={`v2-panel ${className}`} {...props}>{children}</section>
}

export function Chip({ tone = 'info', children }) {
  return <span className={`v2-chip v2-chip--${tone}`}>{children}</span>
}

export function StatCard({ label, value, delta, deltaDirection = 'up', children }) {
  return (
    <div className="v2-stat-card">
      <span className="v2-stat-card__label">{label}</span>
      <strong className="v2-stat-card__value">{value}</strong>
      <span className={`v2-stat-card__delta v2-stat-card__delta--${deltaDirection}`}>{delta}</span>
      {children && <div className="v2-stat-card__sparkline">{children}</div>}
    </div>
  )
}

export function Sparkline({ values = [8, 11, 10, 15, 14, 19], label = 'Upward trend', tone = 'info' }) {
  const width = 140
  const height = 26
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * (width - 6) + 3
    const y = height - 3 - ((value - min) / range) * (height - 6)
    return `${x},${y}`
  }).join(' ')
  const [endX, endY] = points.split(' ').at(-1).split(',')

  return (
    <svg className={`v2-sparkline v2-sparkline--${tone}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <polyline className="v2-sparkline__line" points={points} pathLength="1" />
      <circle cx={endX} cy={endY} r="2.4" />
    </svg>
  )
}

export function ProgressBar({ value, tone = 'info', label }) {
  return (
    <div className="v2-progress" aria-label={label} role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={value}>
      <div className={`v2-progress__fill v2-progress__fill--${tone}`} style={{ '--progress': `${value}%` }} />
    </div>
  )
}

export function ProgressRing({ value, tone = 'exec', label = 'Progress' }) {
  const id = useId()
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - value / 100)
  return (
    <svg className={`v2-ring v2-ring--${tone}`} viewBox="0 0 52 52" role="img" aria-labelledby={id}>
      <title id={id}>{label}: {value}%</title>
      <circle className="v2-ring__track" cx="26" cy="26" r={radius} />
      <circle className="v2-ring__fill" cx="26" cy="26" r={radius} strokeDasharray={circumference} style={{ '--ring-offset': offset }} />
      <text x="26" y="25" textAnchor="middle">{value}%</text>
      <text className="v2-ring__label" x="26" y="34" textAnchor="middle">DONE</text>
    </svg>
  )
}

export function Toast({ visible, tone = 'good', children }) {
  const [mounted, setMounted] = useState(visible)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      setLeaving(false)
      return undefined
    }
    if (!mounted) return undefined
    setLeaving(true)
    const timer = window.setTimeout(() => {
      setMounted(false)
      setLeaving(false)
    }, 220)
    return () => window.clearTimeout(timer)
  }, [visible, mounted])

  // The region portals to document.body (like the mockup's body-level
  // #toasts): position:fixed only anchors to the viewport when no ancestor
  // carries a containing-block trigger, and the zone entrance animation
  // (.v2-zone, fill forwards on transform) retains one at runtime — the F7 /
  // FR-1 defect. Body-level mounting is immune to ancestor CSS by
  // construction.
  return createPortal(
    <div className="v2-toast-region" aria-live="polite" aria-atomic="true">
      {mounted && <div className={`v2-toast v2-toast--${tone}${leaving ? ' v2-toast--leaving' : ''}`}><span className="v2-toast__dot" aria-hidden="true" />{children}</div>}
    </div>,
    document.body,
  )
}

export function Kbd({ children }) {
  return <kbd className="v2-kbd">{children}</kbd>
}
