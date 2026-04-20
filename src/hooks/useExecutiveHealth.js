// src/hooks/useExecutiveHealth.js
//
// Lightweight backend availability guard for executive surfaces.
// Pings GET /api/health on mount and on a 60s interval.
// Exposes { available, checking, recheck } so UI can degrade gracefully.
//
// Uses the existing api.wake() method — no new endpoint required.
// api.wake() returns { ok: true } on success, { ok: false } on network failure.

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../services/api'

const POLL_INTERVAL_MS = 60_000

export function useExecutiveHealth() {
  const [available, setAvailable] = useState(null) // null = unknown, true = up, false = down
  const [checking, setChecking] = useState(false)
  const mountedRef = useRef(true)

  const check = useCallback(async () => {
    setChecking(true)
    try {
      const res = await api.wake()
      if (mountedRef.current) {
        setAvailable(!!(res && res.ok))
      }
    } catch {
      if (mountedRef.current) setAvailable(false)
    } finally {
      if (mountedRef.current) setChecking(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    check()
    const id = setInterval(check, POLL_INTERVAL_MS)
    return () => {
      mountedRef.current = false
      clearInterval(id)
    }
  }, [check])

  return { available, checking, recheck: check }
}

export default useExecutiveHealth
