// src/components/AppLauncherCard.jsx
//
// Phase 3C.B — Branded external app launcher card.
//
// LOCK 3: this is a general-purpose component. Which launchers render
// is controlled by the JSX in MotesartOS.jsx (SOM + Converter only for now).
//
// Props:
//   appId?:    string    — lookup key into APP_LAUNCHERS registry
//   url?:      string    — external URL (overrides registry)
//   label?:    string    — display name (overrides registry)
//   subtitle?: string    — secondary line (overrides registry)
//   color?:    string    — accent color (overrides registry)
//   logoSrc?:  string    — image path; falls back to initials tile when null/missing
//   initials?: string    — single character for initials tile

import { useState } from 'react'
import { APP_LAUNCHERS } from '../config/appLaunchers'

const C = {
  muted:  '#52525e',
  gold:   '#c9a84c',
}

export default function AppLauncherCard({
  appId,
  url, label, subtitle, color, logoSrc, initials,
}) {
  const preset = appId ? (APP_LAUNCHERS[appId] || {}) : {}
  const _url      = url      ?? preset.url
  const _label    = label    ?? preset.label
  const _subtitle = subtitle ?? preset.subtitle ?? 'Launch →'
  const _color    = color    ?? preset.color    ?? C.gold
  const _logoSrc  = logoSrc  ?? preset.logoSrc
  const _initials = initials ?? preset.initials ?? (_label ? _label[0] : '◆')

  const [hover, setHover] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  if (!_url || !_label) return null

  const showLogo = _logoSrc && !logoFailed
  const bgDim   = `${_color}18`
  const bgHover = `${_color}28`

  return (
    <a
      href={_url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: hover ? bgHover : bgDim,
        border: `1px solid ${_color}40`,
        borderRadius: 12,
        padding: '10px 16px',
        textDecoration: 'none',
        transition: 'all 0.18s',
        transform: hover ? 'scale(1.02)' : 'scale(1)',
        minWidth: 220,
      }}
    >
      {/* Logo slot */}
      <div style={{
        width: 36, height: 36,
        borderRadius: 8,
        background: showLogo ? '#fff' : _color,
        border: `1px solid ${_color}50`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
      }}>
        {showLogo ? (
          <img
            src={_logoSrc}
            alt={`${_label} logo`}
            onError={() => setLogoFailed(true)}
            style={{ width: '80%', height: '80%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <span style={{
            fontSize: 15,
            fontWeight: 900,
            color: '#fff',
            letterSpacing: '-0.02em',
            textShadow: '0 1px 0 rgba(0,0,0,0.15)',
          }}>{_initials}</span>
        )}
      </div>

      {/* Text */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          color: _color,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>Open {_label}</div>
        <div style={{
          fontSize: 10,
          color: C.muted,
          marginTop: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{_subtitle}</div>
      </div>
    </a>
  )
}
