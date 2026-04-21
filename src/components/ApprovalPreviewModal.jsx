// src/components/ApprovalPreviewModal.jsx
//
// Phase 3C.A — Reusable approval preview modal.
// Updated: Undo support + mobile polish pass.
//
// Props:
//   item:      object | null
//   onClose:   () => void
//   onApprove: (id) => void
//   onRevise:  (id) => void
//   onUndo:    (id) => void
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

export default function ApprovalPreviewModal({ item, onClose, onApprove, onRevise, onUndo, status = 'pending' }) {
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
        padding: 'max(clamp(8px, 4vw, 20px), env(safe-area-inset-top)) max(clamp(8px, 4vw, 20px), env(safe-area-inset-right)) max(clamp(8px, 4vw, 20px), env(safe-area-inset-bottom)) max(clamp(8px, 4vw, 20px), env(safe-area-inset-left))',
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
          maxHeight: '95dvh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: 'clamp(10px, 3vw, 14px) clamp(12px, 4vw, 20px)',
          borderBottom: `1px solid ${T.border}`,
          background: T.cardHi,
          position: 'sticky', top: 0, zIndex: 1,
          flexShrink: 0,
        }}>
          <Badge text={item.type} color={T.blue} dim={T.blueDim} />
          <Badge text={item.artist} color={T.gold} dim={T.goldDim} />
          <StatusPill status={status} />
          <div style={{ marginLeft: 'auto' }}>
            {/* Larger tap target on mobile */}
            <button onClick={onClose} style={{
              background: 'transparent', border: `1px solid ${T.border}`,
              color: T.muted, borderRadius: 8,
              minWidth: 44, minHeight: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 16, lineHeight: 1,
              fontFamily: 'inherit', padding: 0,
            }}>✕</button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div style={{
          padding: 'clamp(12px, 4vw, 18px) clamp(12px, 4vw, 20px)',
          flex: 1,
          overflowY: 'auto',
        }}>
          {/* Title */}
          <div style={{
            fontSize: 'clamp(14px, 4vw, 16px)',
            color: T.white, fontWeight: 700,
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
              minHeight: 160,
            }}>
              {item.media_type === 'image' ? (
                <img
                  src={item.preview_url}
                  alt={item.item}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 'clamp(200px, 40vh, 50vh)',
                    width: '100%',
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
                    maxHeight: 'clamp(200px, 40vh, 50vh)',
                    width: '100%',
                    display: 'block',
                  }}
                />
              )}
            </div>
          )}

          {/* No-preview state */}
          {isVisual && !item.preview_url && (
            <div style={{
              background: T.dim, border: `1px dashed ${T.border}`, borderRadius: 10,
              padding: 'clamp(20px, 5vw, 32px) 20px', textAlign: 'center', marginBottom: 14,
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
                letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6,
              }}>Caption</div>
              <div style={{
                background: T.dim, border: `1px solid ${T.border}`,
                borderRadius: 8, padding: '10px 14px',
                fontSize: 13, color: T.white, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>{item.caption}</div>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 9, color: T.muted, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6,
              }}>Notes</div>
              <div style={{
                fontSize: 12, color: T.white, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>{item.notes}</div>
            </div>
          )}

          {/* Revision note — Lock 3: only when status === revision_requested AND reason present */}
          {status === 'revision_requested' && item.revision_reason && (
            <div style={{ marginBottom: 4 }}>
              <div style={{
                fontSize: 9, color: T.amber, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6,
              }}>Revision Note</div>
              <div style={{
                background: T.amberDim, border: `1px solid ${T.amber}30`,
                borderRadius: 8, padding: '10px 14px',
                fontSize: 12, color: T.white, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>{item.revision_reason}</div>
            </div>
          )}
        </div>

        {/* Footer — wraps on mobile */}
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end',
          padding: 'clamp(10px, 3vw, 14px) clamp(12px, 4vw, 20px)',
          borderTop: `1px solid ${T.border}`,
          background: T.cardHi,
          position: 'sticky', bottom: 0,
          flexShrink: 0,
        }}>
          {isPending ? (
            <>
              <button
                onClick={() => onRevise(item.content_id || item.id)}
                style={{
                  flex: '1 1 auto', minWidth: 130, minHeight: 44,
                  background: T.redDim, border: `1px solid ${T.red}40`, color: T.red,
                  borderRadius: 8, padding: '10px 16px',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'inherit',
                }}
              >↺ Request Revision</button>
              <button
                onClick={() => onApprove(item.content_id || item.id)}
                style={{
                  flex: '1 1 auto', minWidth: 130, minHeight: 44,
                  background: T.greenDim, border: `1px solid ${T.green}40`, color: T.green,
                  borderRadius: 8, padding: '10px 16px',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'inherit',
                }}
              >✓ Approve</button>
            </>
          ) : (
            <>
              {onUndo && (
                <button
                  onClick={() => onUndo(item.content_id || item.id)}
                  style={{
                    flex: '1 1 auto', minWidth: 100, minHeight: 44,
                    background: 'transparent', border: `1px solid ${T.border}`, color: T.muted,
                    borderRadius: 8, padding: '10px 16px',
                    cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'inherit',
                  }}
                >↩ Undo</button>
              )}
              <button
                onClick={onClose}
                style={{
                  flex: '1 1 auto', minWidth: 100, minHeight: 44,
                  background: T.dim, border: `1px solid ${T.border}`, color: T.muted,
                  borderRadius: 8, padding: '10px 16px',
                  cursor: 'pointer', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'inherit',
                }}
              >Close</button>
            </>
          )}
        </div>

        <style>{`
          @keyframes approvalFadeIn { from { opacity: 0; } to { opacity: 1; } }
          @media (max-width: 480px) {
            /* bottom-sheet feel on phones */
          }
        `}</style>
      </div>
    </div>
  )
}
