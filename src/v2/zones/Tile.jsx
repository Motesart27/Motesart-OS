// Tile.jsx — MOSV2-C presentational tile-state renderer (PLAN §8/§9).
// Renders every canonical tile state from props only — no fetching here.
// ZoneErrorBoundary scopes crashes to one zone; siblings never crash.

import { Component, useEffect, useRef, useState } from 'react'
import './zones.css'
import { TILE_STATUS } from '../data/tileMachine.js'

const STATUS_ANNOUNCEMENTS = Object.freeze({
  [TILE_STATUS.LOADING]: 'loading',
  [TILE_STATUS.POPULATED]: 'updated',
  [TILE_STATUS.EMPTY]: 'nothing to show',
  [TILE_STATUS.PARTIAL]: 'partially available',
  [TILE_STATUS.STALE]: 'showing last known data',
  [TILE_STATUS.ERROR]: 'unreachable',
  [TILE_STATUS.PERMISSION_DENIED]: 'sign-in needed',
  [TILE_STATUS.OFFLINE]: 'offline',
  [TILE_STATUS.B2_PENDING]: 'unavailable',
})

// Polite live region announcing state transitions only — populated data does
// not re-announce on refresh (§9 a11y law).
export function TileStatus({ status, title }) {
  const [announcement, setAnnouncement] = useState('')
  const previous = useRef(status)

  useEffect(() => {
    if (previous.current === status) return
    previous.current = status
    const label = STATUS_ANNOUNCEMENTS[status] || status
    setAnnouncement(`${title} ${label}`)
  }, [status, title])

  return <span role="status" className="v2-tile__sr">{announcement}</span>
}

// Mono HH:MM for the stale "as of" tag. Untruthful input renders dashes.
export function formatAsOf(timestamp) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '--:--'
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

// Partial-state value: absent values render an em-dash, never blank (§8).
export function TileValue({ value }) {
  if (value === null || value === undefined || value === '') {
    return <span className="v2-tile__dash" aria-label="not available">—</span>
  }
  return <>{value}</>
}

function TileSkeleton({ rows }) {
  return (
    <div className="v2-tile__skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => <i key={index} />)}
    </div>
  )
}

function QuietLine({ tone = 'good', children }) {
  return (
    <p className={`v2-tile__quiet v2-tile__quiet--${tone}`}>
      <span className={`v2-tile__dot v2-tile__dot--${tone}`} aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

function ErrorBody({ title, copy, onRetry }) {
  return (
    <div className="v2-tile__error">
      <QuietLine tone="crit">{copy}</QuietLine>
      {onRetry && (
        <button type="button" className="v2-tile__retry" aria-label={`Retry ${title}`} onClick={onRetry}>
          Retry ↻
        </button>
      )}
    </div>
  )
}

export function Tile({
  title,
  status,
  error = null,
  updatedAt = null,
  onRetry,
  emptyCopy = 'Nothing here right now.',
  unavailableCopy = 'Unavailable.',
  scopeTag = null,
  skeletonRows = 3,
  children,
  className = '',
}) {
  let body
  switch (status) {
    case TILE_STATUS.IDLE:
    case TILE_STATUS.LOADING:
      body = <TileSkeleton rows={skeletonRows} />
      break
    case TILE_STATUS.EMPTY:
      body = <QuietLine tone="good">{emptyCopy}</QuietLine>
      break
    case TILE_STATUS.ERROR:
      body = <ErrorBody title={title} copy={(error && error.message) || `${title} unreachable`} onRetry={onRetry} />
      break
    case TILE_STATUS.PERMISSION_DENIED:
      // Tile-local sign-in state only — never a logout or redirect (9.5).
      body = <ErrorBody title={title} copy="Sign-in needed — this tile will resume after you sign in again." onRetry={onRetry} />
      break
    case TILE_STATUS.OFFLINE:
      body = children
        ? <StaleBody updatedAt={updatedAt} dotLabel="offline">{children}</StaleBody>
        : <ErrorBody title={title} copy="You appear to be offline." onRetry={onRetry} />
      break
    case TILE_STATUS.STALE:
      body = <StaleBody updatedAt={updatedAt}>{children}</StaleBody>
      break
    case TILE_STATUS.PARTIAL:
      body = (
        <div className="v2-tile__partial">
          {children}
          {scopeTag && <span className="v2-tile__scope">{scopeTag}</span>}
        </div>
      )
      break
    case TILE_STATUS.B2_PENDING:
      body = <QuietLine tone="warn">{unavailableCopy}</QuietLine>
      break
    default:
      body = children
  }

  return (
    <div className={`v2-tile v2-tile--${status} ${className}`} data-status={status}>
      <TileStatus status={status} title={title} />
      {body}
    </div>
  )
}

function StaleBody({ updatedAt, dotLabel = 'stale', children }) {
  return (
    <div className="v2-tile__stale">
      <span className="v2-tile__stale-dot" role="img" aria-label={dotLabel} />
      {children}
      <span className="v2-tile__asof">as of {formatAsOf(updatedAt)}</span>
    </div>
  )
}

// One error boundary per zone: a crashing zone renders its own error state
// and never takes the shell or sibling zones down (PLAN §7 errors).
export class ZoneErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
    this.handleRetry = this.handleRetry.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  handleRetry() {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <div className="v2-zone-error" role="alert">
          <Tile
            title={this.props.zone || 'This zone'}
            status={TILE_STATUS.ERROR}
            error={{ kind: 'http', message: `${this.props.zone || 'This zone'} hit an error` }}
            onRetry={this.handleRetry}
          />
        </div>
      )
    }
    return this.props.children
  }
}
