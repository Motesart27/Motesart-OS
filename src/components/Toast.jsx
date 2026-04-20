// src/components/Toast.jsx
//
// Lightweight toast system — zero dependencies.
// Matches Motesart OS dark + gold aesthetic.
//
// Usage:
//   <ToastProvider>...</ToastProvider>   (wrapped in main.jsx around the app)
//   const toast = useToast()
//   toast.success("Title", "Body", { accent: "#c9a84c", duration: 5000 })
//   toast.error("Title", "Body")
//   toast.info("Title", "Body", { accent: "#5a8fc9" })

import { createContext, useCallback, useContext, useState } from 'react'

const T = {
  bg:      '#111116',
  border:  'rgba(255,255,255,0.08)',
  white:   '#f0ede8',
  gold:    '#c9a84c',
  green:   '#4caf7d',
  red:     '#c95a5a',
  blue:    '#5a8fc9',
}

const ToastContext = createContext(null)

let idCounter = 0
function nextId() { return `toast_${Date.now()}_${idCounter++}` }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback(({ kind = 'info', title = '', body = '', accent, duration }) => {
    const id = nextId()
    const defaultAccent = kind === 'success' ? T.green : kind === 'error' ? T.red : T.blue
    const t = {
      id, kind, title, body,
      accent: accent || defaultAccent,
      duration: duration ?? (kind === 'error' ? 7000 : 5000),
    }
    setToasts(prev => [...prev, t])
    if (t.duration > 0) {
      setTimeout(() => dismiss(id), t.duration)
    }
    return id
  }, [dismiss])

  const api = {
    push,
    dismiss,
    success: (title, body, opts = {}) => push({ kind: 'success', title, body, accent: opts.accent || T.green, duration: opts.duration }),
    error:   (title, body, opts = {}) => push({ kind: 'error',   title, body, accent: opts.accent || T.red,   duration: opts.duration }),
    info:    (title, body, opts = {}) => push({ kind: 'info',    title, body, accent: opts.accent || T.blue,  duration: opts.duration }),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
        maxWidth: 380,
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            style={{
              pointerEvents: 'auto',
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderLeft: `3px solid ${t.accent}`,
              borderRadius: 10,
              padding: '10px 14px',
              cursor: 'pointer',
              color: T.white,
              boxShadow: '0 6px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
              backdropFilter: 'blur(12px)',
              animation: 'slideInRight 0.35s cubic-bezier(0.22,1,0.36,1) both',
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            {t.title && (
              <div style={{
                fontSize: 10,
                color: t.accent,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: t.body ? 4 : 0,
              }}>{t.title}</div>
            )}
            {t.body && (
              <div style={{
                fontSize: 12,
                color: T.white,
                lineHeight: 1.5,
              }}>{t.body}</div>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      push: () => null, dismiss: () => {},
      success: () => null, error: () => null, info: () => null,
    }
  }
  return ctx
}

export default ToastProvider
