import type { KeyboardEvent } from 'react'

// A scanner types a whole barcode in a few dozen milliseconds; a person cannot
// sustain even 50ms per character. That gap is what tells the two apart when
// the scanner is not set up to send a terminator key (Enter/Tab) at all.
const MIN_SCAN_CHARS = 5
const MAX_AVG_GAP_MS = 50
// Longest silence still counted as the same burst, and how long to wait after
// the last character before deciding the scan is over.
const MAX_BURST_GAP_MS = 100
const SCAN_END_IDLE_MS = 120

type Burst = { first: number; last: number; count: number; timer: number }
const bursts = new WeakMap<HTMLInputElement, Burst>()

function dropBurst(el: HTMLInputElement): void {
  const burst = bursts.get(el)
  if (burst) window.clearTimeout(burst.timer)
  bursts.delete(el)
}

/**
 * Call from an input's onKeyDown. Recognises a barcode scan by its speed —
 * a burst of fast keystrokes that then goes quiet — and calls `onScan` once
 * it ends, a moment after the last character.
 *
 * `onScan` runs on a timer, after the keystroke that scheduled it, so it must
 * read current state through a ref rather than the render it was created in:
 * the last character of the barcode has not landed in state yet when the key
 * goes down.
 *
 * Anything that is not a plain character (Backspace, arrows, Enter, Tab…)
 * means a person is driving, or that the scanner sent its own terminator and
 * the caller's key handling has it covered, so the pending scan is dropped.
 */
export function watchForScan(
  event: KeyboardEvent<HTMLInputElement>,
  onScan: (el: HTMLInputElement) => void
): void {
  const el = event.currentTarget

  // Scanners send Shift for capitals and symbols; that is part of the burst,
  // not a break in it.
  if (event.key === 'Shift' || event.key === 'CapsLock') return

  const isCharacter = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
  if (!isCharacter) {
    dropBurst(el)
    return
  }

  const now = performance.now()
  let burst = bursts.get(el)
  if (!burst || now - burst.last > MAX_BURST_GAP_MS) {
    dropBurst(el)
    burst = { first: now, last: now, count: 0, timer: 0 }
    bursts.set(el, burst)
  }
  burst.count += 1
  burst.last = now
  window.clearTimeout(burst.timer)
  const current = burst
  burst.timer = window.setTimeout(() => {
    bursts.delete(el)
    const fast =
      current.count >= MIN_SCAN_CHARS &&
      (current.last - current.first) / (current.count - 1) <= MAX_AVG_GAP_MS
    if (fast && el.isConnected && document.activeElement === el) onScan(el)
  }, SCAN_END_IDLE_MS)
}
