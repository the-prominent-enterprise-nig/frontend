import type { KeyboardEvent } from 'react'
import { watchForScan } from '@/src/libs/scanner/watchForScan'

/** Spread onto every serial box so `advanceOnScan` can find its neighbours. */
export const serialScanProps = { 'data-serial-scan': '' } as const

/** The next serial box on screen after `el`, if there is one. */
function nextBox(el: HTMLInputElement): HTMLInputElement | undefined {
  // Skips boxes that are mounted but not on screen (the wide/narrow layouts
  // are media-query siblings), which could never take focus anyway.
  const boxes = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[data-serial-scan]')
  ).filter((box) => !box.disabled && box.getClientRects().length > 0)
  return boxes[boxes.indexOf(el) + 1]
}

function moveTo(next: HTMLInputElement): void {
  next.focus()
  // A box that already holds a serial is overwritten by the next scan rather
  // than appended to.
  next.select()
}

/**
 * Moves focus to the next serial box when a barcode scanner finishes a scan.
 *
 * A scanner is a keyboard that types the barcode and then, depending on how it
 * is configured, a terminator — Enter, Tab, or nothing at all. All three have
 * to hand focus to the next box, otherwise the receiver scanning ten units
 * types into the first one ten times. Enter and Tab act at once; with no
 * terminator the scan is recognised by its speed and focus moves a moment
 * after the last character.
 *
 * "Next" is the next serial box on the screen, not the next one in the same
 * drawer: a PO is usually many serial-tracked lines of a unit or two each, so
 * the box after a line's last unit is the first unit of the line below it.
 *
 * Shift+Tab is left alone so a person can still step backwards. On the very
 * last box Enter is swallowed (it must not submit the surrounding form) and
 * Tab keeps its normal exit.
 */
export function advanceOnScan(event: KeyboardEvent<HTMLInputElement>): void {
  // No terminator: the scan is recognised by its speed instead.
  watchForScan(event, (el) => {
    const next = nextBox(el)
    if (next) moveTo(next)
  })

  const isEnter = event.key === 'Enter'
  const isTab = event.key === 'Tab' && !event.shiftKey
  if (!isEnter && !isTab) return

  const next = nextBox(event.currentTarget)
  if (isEnter || next) event.preventDefault()
  if (next) moveTo(next)
}
