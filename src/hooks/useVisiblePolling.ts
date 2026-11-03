import { useEffect, useRef } from 'react'

/** Coming back to a tab refreshes it only if the data is at least this stale. */
const MIN_REFRESH_GAP_MS = 10_000

interface Options {
  /** Run once on mount. Pass false when another effect already loads on mount. */
  immediate?: boolean
}

/**
 * Calls `callback` every `intervalMs` while the tab is visible, and once more
 * whenever the user comes back to it.
 *
 * A bare `setInterval(load, 30_000)` keeps firing in tabs nobody is looking at
 * (browsers only throttle hidden timers to once a minute). For the Accounting
 * dashboard, whose `load` fans out 11 API calls, a few forgotten tabs became a
 * permanent burst against the backend. This version also:
 * - never starts a run while the previous one is still going, and
 * - treats the `focus` + `visibilitychange` pair a tab switch fires as one
 *   refresh, not two (a refresh within MIN_REFRESH_GAP_MS of the last is skipped).
 *
 * The latest `callback` is always the one called, so it need not be memoized.
 */
export function useVisiblePolling(
  callback: () => unknown,
  intervalMs: number,
  { immediate = true }: Options = {}
) {
  const latest = useRef(callback)
  useEffect(() => {
    latest.current = callback
  })

  useEffect(() => {
    let inFlight = false
    let lastRun = 0
    let timer: ReturnType<typeof setInterval> | null = null

    async function run() {
      if (inFlight) return
      inFlight = true
      lastRun = Date.now()
      try {
        await latest.current()
      } finally {
        inFlight = false
      }
    }

    function startTimer() {
      if (timer === null) timer = setInterval(run, intervalMs)
    }

    function stopTimer() {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    }

    function handleReturn() {
      if (document.visibilityState !== 'visible') return
      startTimer()
      if (Date.now() - lastRun >= MIN_REFRESH_GAP_MS) void run()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') handleReturn()
      else stopTimer()
    }

    if (immediate) void run()
    if (document.visibilityState === 'visible') startTimer()
    window.addEventListener('focus', handleReturn)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      stopTimer()
      window.removeEventListener('focus', handleReturn)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [intervalMs, immediate])
}
