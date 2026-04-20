// src/components/ApprovalPreviewModal.jsx
//
// Phase 3C.A — Reusable approval preview modal.
// Renders preview for VISUAL, CAPTION, STRATEGY, BUILD, CONTENT approval types.
//
// LOCK 2: when item.preview_url is null for a visual, renders the "no preview
// set" dashed state — no remote placeholder, no broken image icon.
//
// Props:
//   item:      object | null      — the approval item (null = closed)
//   onClose:   () => void
//   onApprove: (id) => void
//   onRevise:  (id) => void
//   status:    "pending" | "approved" | "revision_requested"

import { useEffect } from 'react'

const T = {
  bg:        '#070709',
  card:      '#111116',
  cardHi:    '#17171e',
  border:    'rgba(255,255,255,0.055)',
  borderHi:  'rgba(201,168,76,0.28)',
  gold:      '#c9a84c',
  goldDim:   'rgba(201,168,76,0.10)',
  white:     '#f0ede8',
  muted:     '#52525e',
  dim:       '#1c1c22',
  green:     '#4caf7d',
  greenDim:  'rgba(76,175,125,0.12)',
  red:       '#c95a5a',
  redDim:    'rgba(201,90,90,0.12)',
  blue:      '#5a8fc9',
  blueDim:   'rgba(90,143,201,0.12)',
  amber:     '#c9914c',
  amberDim:  'rgba(201,145,76,0.12)',
}

function Badge({ text, color, dim }) {
  return (
    <span style={{
      fontSize: 10, color, fontWeight: 700,
      background: dim, border: `1px solid ${color}30`,
      padding: '3px 8px', borderRadius: 4,
      letterSpacing: '0.08em', textTransform: 'uppercase',
    }}>{text}</span>
  )
}

function StatusPill({ status }) {
  if (status === 'approved') {
    return <Badge text="✓ Approved" color={T.green} dim={T.greenDim} />
  }
  if (status === 'revision_requested') {
    return <Badge text="↺ Revision Requested" color={T.amber} dim={T.amberDim} />
  }
  return <Badge text="Pending" color={T.muted} dim={T.dim} />
}

export default function ApprovalPreviewModal({ item, onClose, onApprove, onRevise, status = 'pending' }) {
  // ESC key closes + body scroll lock
  useEffect(() => {
    if (!item) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [item, onClose])

  if (!item) return null

  const isVisual = item.media_type === 'image' || item.media_type === 'video'
  const isPending = status === 'pending'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'approvalFadeIn 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: 16,
          maxWidth: 720,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '14px 20px',
          borderBottom: `1px solid ${T.border}`,
          background: T.cardHi,
          position: 'sticky', top: 0, zIndex: 1,
        }}>
          <Badge text={item.type} color={T.blue} dim={T.blueDim} />
          <Badge text={item.artist} color={T.gold} dim={T.goldDim} />
          <StatusPill status={status} />
          <div style={{ marginLeft: 'auto' }}>
            <button onClick={onClose} style={{
              background: 'transparent', border: `1px solid ${T.border}`,
              color: T.muted, borderRadius: 6, padding: '4px 10px',
              cursor: 'pointer', fontSize: 14, lineHeight: 1,
              fontFamily: 'inherit',
            }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px' }}>
          {/* Title */}
          <div style={{
            fontSize: 16, color: T.white, fontWeight: 700,
            marginBottom: 14, letterSpacing: '-0.01em', lineHeight: 1.4,
          }}>{item.item}</div>

          {/* Visual preview */}
          {isVisual && item.preview_url && (
            <div style={{
              background: T.dim,
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              overflow: 'hidden',
              marginBottom: 14,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: 200,
            }}>
              {item.media_type === 'image' ? (
                <img
                  src={item.preview_url}
                  alt={item.item}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '50vh',
                    display: 'block',
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <video
                  src={item.preview_url}
                  controls
                  style={{
                    maxWidth: '100%',
                    maxHeight: '50vh',
                    display: 'block',
                  }}
                />
              )}
            </div>
          )}

          {/* No-preview state for visuals */}
          {isVisual && !item.preview_url && (
            <div style={{
              background: T.dim, border: `1px dashed ${T.border}`, borderRadius: 10,
              padding: '32px 20px', textAlign: 'center', marginBottom: 14,
              color: T.muted, fontSize: 12, lineHeight: 1.6,
            }}>
              <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.4 }}>◉</div>
              No preview asset uploaded yet.<br />
              <span style={{ fontSize: 11 }}>
                Drop the file at <code style={{ color: T.white }}>public/brand/approvals/</code> and set{' '}
                <code style={{ color: T.white }}>preview_url</code> in the approvals config.
              </span>
            </div>
          )}

          {/* Caption */}
          {item.caption && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 9, color: T.muted, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                marginBottom: 6,
              }}>Caption</div>
              <div style={{
                background: T.dim,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: T.white,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>{item.caption}</div>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div style={{ marginBottom: 4 }}>
              <div style={{
                fontSize: 9, color: T.muted, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                marginBottom: 6,
              }}>Notes</div>
              <div style={{
                fontSize: 12,
                color: T.white,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>{item.notes}</div>
            </div>
          )}
        </div>

        {/* Footer action bar */}
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          padding: '14px 20px',
          borderTop: `1px solid ${T.border}`,
          background: T.cardHi,
          position: 'sticky', bottom: 0,
        }}>
          {isPending ? (
            <>
              <button
                onClick={() => onRevise(item.id)}
                style={{
                  background: T.redDim,
                  border: `1px solid ${T.red}40`,
                  color: T.red,
                  borderRadius: 6, padding: '8px 16px',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  fontFamily: 'inherit',
                }}
              >↺ Request Revision</button>
              <button
                onClick={() => onApprove(item.id)}
                style={{
                  background: T.greenDim,
                  border: `1px solid ${T.green}40`,
                  color: T.green,
                  borderRadius: 6, padding: '8px 16px',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  fontFamily: 'inherit',
                }}
              >✓ Approve</button>
            </>
          ) : (
            <button
              onClick={onClose}
              style={{
                background: T.dim,
                border: `1px solid ${T.border}`,
                color: T.muted,
                borderRadius: 6, padding: '8px 16px',
                cursor: 'pointer', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                fontFamily: 'inherit',
              }}
            >Close</button>
          )}
        </div>

        <style>{`
          @keyframes approvalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </div>
    </div>
  )
}
