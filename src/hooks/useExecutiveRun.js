// src/hooks/useExecutiveRun.js
//
// Reusable hook for running a backend Executive (SOM, FM, E7A, Book).
// Phase 3B ships this for SOM. Phase 3C reuses it verbatim for the rest.
//
// Usage:
//   const { run, runDryRun, loading, lastResult, error, reset } = useExecutiveRun("som")
//
// Contract:
//   run()        → POST /api/executives/{name}/run  body: {}
//   runDryRun()  → POST /api/executives/{name}/run  body: { dry_run: true }
//   On success, dispatches window event "executive-run-complete" for future listeners.
//   Errors are caught and surfaced on `error`; the hook never throws.

import { useState, useCallback } from 'react'
import { api } from '../services/api'

export function useExecutiveRun(executiveName) {
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [error, setError] = useState(null)

  const _call = useCallback(async (body) => {
    if (!executiveName) {
      setError('No executive name provided')
      return null
    }
    setLoading(true)
    setError(null)
    try {
      const result = await api.runExecutive(executiveName, body)

      // Backend returns {ok: true, ...} on success.
      // api.post returns parsed JSON in both success and error cases.
      if (result && result.ok === true) {
        setLastResult(result)
        try {
          window.dispatchEvent(new CustomEvent('executive-run-complete', {
            detail: { executive: executiveName, result },
          }))
        } catch { /* noop */ }
        return result
      } else {
        const msg = result?.detail || result?.error || result?.message || 'Executive run failed'
        setError(msg)
        return null
      }
    } catch (e) {
      setError(e?.message || String(e) || 'Network error')
      return null
    } finally {
      setLoading(false)
    }
  }, [executiveName])

  const run = useCallback(() => _call({}), [_call])
  const runDryRun = useCallback(() => _call({ dry_run: true }), [_call])
  const reset = useCallback(() => {
    setLastResult(null)
    setError(null)
  }, [])

  return { run, runDryRun, loading, lastResult, error, reset }
}

export default useExecutiveRun
