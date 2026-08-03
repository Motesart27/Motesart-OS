// Z5QuickActions.jsx — Z5 Quick Actions zone (PLAN §8 Z5, §10 qbtn + toast
// rows). The ONLY write surface of Phase C — and this stage wires it
// fixture-backed only: the default dispatcher is adapters/dispatch.js
// fixtureDispatch, a deterministic zero-network simulation of the backend's
// approval-gated outcome (requires_approval:true ⇒ approval_status "pending";
// nothing is ever created or executed). The live POST /api/tasks wiring is
// gated behind the §3.4 response-shape gate and the preview-deploy dispatch
// smoke, and no real Z5 submission is authorized this stage (see the dispatch
// adapter header). qbtn law (§10): optimistic dispatch, NO disabled state
// (DB-G8 stays Button-only), control resets immediately, failure ⇒ one crit
// toast, no auto-retry. Toast is the Phase A component: aria-live="polite",
// never steals focus, auto-dismiss ~3s, opacity-only motion.

import { useEffect, useRef, useState } from 'react'
import './zones.css'
import { Toast } from '../components/index.jsx'
import { fixtureDispatch, mapDispatchResult } from '../data/adapters/dispatch.js'
import { DISPATCH_FAILURE_COPY, QUICK_ACTIONS, dispatchToast } from './z5QuickActions.js'

const TOAST_DISMISS_MS = 3000

// Hand-rolled icons ported verbatim from the desktop mockup's five qbtns
// (24×24, stroke currentColor, 1.7 width). Decorative — the button's
// accessible name is the action label (§10).
const ACTION_ICONS = Object.freeze({
  'new-student': (
    <>
      <circle cx="10" cy="8" r="3.4" />
      <path d="M4 20c.7-3.6 3.1-5.6 6-5.6M17 14.5v6M14 17.5h6" />
    </>
  ),
  'create-invoice': (
    <>
      <path d="M5 3h14v18l-2.3-1.6L14.4 21l-2.4-1.6L9.6 21l-2.3-1.6L5 21z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  'brain-dump': (
    <path d="M9.5 4a3.5 3.5 0 0 0-3.4 4.3A3.8 3.8 0 0 0 4 12a3.8 3.8 0 0 0 2.5 3.6A3.5 3.5 0 0 0 12 19V6.5A3.5 3.5 0 0 0 9.5 4ZM14.5 4a3.5 3.5 0 0 1 3.4 4.3A3.8 3.8 0 0 1 20 12a3.8 3.8 0 0 1-2.5 3.6A3.5 3.5 0 0 1 12 19" />
  ),
  'voice-note': (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  'capture-idea': (
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.4 10.9c.9.7 1.4 1.3 1.4 2.1h4c0-.8.5-1.4 1.4-2.1A6 6 0 0 0 12 3Z" />
  ),
})

export default function Z5QuickActions({ dispatch = fixtureDispatch }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const showToast = (next) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    setToast(next)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setToast(null)
    }, TOAST_DISMISS_MS)
  }

  // Optimistic dispatch (§10): no pending visual, no disabled state — the
  // control is immediately ready again. Exactly one toast per click: success
  // copy from the response's assigned_agent, or the ruled failure line on any
  // rejection. No auto-retry.
  const onDispatch = (action) => {
    Promise.resolve()
      .then(() => dispatch(action))
      .then((result) => showToast(dispatchToast(mapDispatchResult(result), action)))
      .catch(() => showToast({ tone: 'crit', copy: DISPATCH_FAILURE_COPY }))
  }

  return (
    <div className="v2-zone__body v2-z5">
      <div className="v2-qa">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.key}
            type="button"
            className="v2-qbtn"
            onClick={() => onDispatch(action)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ACTION_ICONS[action.key]}
            </svg>
            {action.label}
          </button>
        ))}
      </div>
      <Toast visible={toast !== null} tone={toast ? toast.tone : 'good'}>
        {toast ? toast.copy : ''}
      </Toast>
    </div>
  )
}
