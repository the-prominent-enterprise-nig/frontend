'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { updateCountLine } from '../_actions/update-count-line'
import type { UpdateCountLineValues } from '@/src/schema/inventory/stock-counts'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/** How long after the last keystroke a line is saved — long enough that a
 * remark isn't saved letter by letter, short enough to lose nothing. */
const DELAY_MS = 700

/**
 * Scenario 87 — saves Count Sheet lines as the counter goes. Changes to the
 * same line are merged and sent once the counter pauses; a failed save is
 * kept and retried with the next one (or with retry()).
 */
export function useCountAutosave(countId: string | undefined) {
  const pending = useRef(new Map<string, UpdateCountLineValues>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlight = useRef(0)
  const [status, setStatus] = useState<AutosaveStatus>('idle')

  const flush = useCallback(async () => {
    if (!countId || pending.current.size === 0) return
    const batch = [...pending.current.entries()]
    pending.current.clear()
    inFlight.current += 1
    setStatus('saving')
    const results = await Promise.all(
      batch.map(async ([lineId, patch]) => ({
        lineId,
        patch,
        ok: (await updateCountLine(countId, lineId, patch)).success,
      }))
    )
    inFlight.current -= 1
    const failed = results.filter((r) => !r.ok)
    // Keep what didn't save, under anything newer typed for the same line.
    for (const f of failed)
      pending.current.set(f.lineId, { ...f.patch, ...pending.current.get(f.lineId) })
    if (failed.length) setStatus('error')
    else if (inFlight.current === 0 && pending.current.size === 0) setStatus('saved')
  }, [countId])

  const queue = useCallback(
    (lineId: string, patch: UpdateCountLineValues) => {
      pending.current.set(lineId, { ...pending.current.get(lineId), ...patch })
      setStatus('saving')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flush(), DELAY_MS)
    },
    [flush]
  )

  /** Drops unsent changes — for after Submit or Cancel, when the server
   * would refuse them anyway. */
  const discard = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    pending.current.clear()
    setStatus('idle')
  }, [])

  // Warn before the tab closes with changes not yet on the server.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent): void => {
      if (pending.current.size === 0 && inFlight.current === 0) return
      e.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  return { status, queue, retry: flush, discard }
}
