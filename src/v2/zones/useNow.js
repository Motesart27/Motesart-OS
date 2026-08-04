// useNow.js — shared client-clock tick for Z1/Z2 (PLAN §8 Z1 greeting,
// Z2 countdowns). 30s tick, pauses when the tab is hidden (9.3 hidden-tab
// law), and refreshes immediately on return — never bursts.

import { useEffect, useState } from 'react'

export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer = null
    const tick = () => setNow(new Date())
    const start = () => {
      if (timer !== null) return
      timer = window.setInterval(tick, intervalMs)
    }
    const stop = () => {
      if (timer === null) return
      window.clearInterval(timer)
      timer = null
    }
    const onVisibility = () => {
      if (document.hidden) {
        stop()
      } else {
        tick()
        start()
      }
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])

  return now
}
