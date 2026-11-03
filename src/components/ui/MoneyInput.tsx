'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * An amount field that groups thousands as you type (500000 → 500,000) while the
 * form keeps holding the plain number ("500000.5"), so submitting is unchanged:
 * `Number(form.amount)` still works. Digits and one decimal point only, at most
 * two decimals; a leading minus when `allowNegative` (a bank statement can be
 * overdrawn). Pasted text such as "₱1,000.50" is cleaned the same way.
 *
 * It is a text input with `inputMode="decimal"`, not `type="number"`: a number
 * input cannot show commas, and it also reacts to the scroll wheel.
 */

/** What the form should hold for whatever was typed or pasted. */
export function cleanMoney(text: string, allowNegative = false): string {
  const negative = allowNegative && text.trim().startsWith('-')
  let cleaned = text.replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned
        .slice(firstDot + 1)
        .replace(/\./g, '')
        .slice(0, 2)
  }
  const [whole, decimals] = cleaned.split('.')
  // "007" reads as 7, but "0" and "0.5" stay as they are.
  const wholeDigits = whole.replace(/^0+(?=\d)/, '')
  const body = decimals === undefined ? wholeDigits : `${wholeDigits}.${decimals}`
  return negative ? `-${body}` : body
}

/** The plain number as shown in the box: thousands grouped, decimals as typed. */
export function formatMoney(raw: string): string {
  if (!raw) return ''
  const negative = raw.startsWith('-')
  const unsigned = negative ? raw.slice(1) : raw
  const [whole, decimals] = unsigned.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const body = decimals === undefined ? grouped : `${grouped}.${decimals}`
  return negative ? `-${body}` : body
}

type Props = {
  /** The plain number, e.g. "1234567.5" — never contains commas. */
  value: string
  onChange: (value: string) => void
  allowNegative?: boolean
  required?: boolean
  placeholder?: string
  className?: string
  id?: string
  name?: string
  disabled?: boolean
  'aria-label'?: string
}

export default function MoneyInput({ value, onChange, allowNegative = false, ...rest }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  // How many digits, dots and minus signs sat before the caret when the text last changed;
  // after re-grouping, the caret goes back after that many of them, so typing in
  // the middle of a number does not throw the caret to the end.
  const caretAfter = useRef<number | null>(null)
  // A pending "put the caret back" for a refused keystroke. Each later keystroke
  // cancels it: left alone it would fire after a LATER accepted keystroke and
  // drag the caret back to where the refused one was.
  const pendingFrame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(pendingFrame.current), [])
  const display = formatMoney(value)

  useLayoutEffect(() => {
    const el = inputRef.current
    const count = caretAfter.current
    caretAfter.current = null
    cancelAnimationFrame(pendingFrame.current)
    if (!el || count === null || document.activeElement !== el) return
    let seen = 0
    let pos = 0
    while (pos < display.length && seen < count) {
      if (/[0-9.-]/.test(display[pos])) seen++
      pos++
    }
    el.setSelectionRange(pos, pos)
  }, [display])

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={display}
      onChange={(e) => {
        const el = e.target
        cancelAnimationFrame(pendingFrame.current)
        const caret = el.selectionStart ?? el.value.length
        caretAfter.current = el.value.slice(0, caret).replace(/[^0-9.-]/g, '').length
        const next = cleanMoney(el.value, allowNegative)
        if (next === value) {
          // Nothing the form holds changed (a letter was typed, say), so React will
          // not re-render — put the caret back where it was, minus what was refused.
          const back = Math.max(0, caret - (el.value.length - display.length))
          pendingFrame.current = requestAnimationFrame(() => {
            // Only put a caret back where there still is one: if something has
            // selected text in the meantime (select-all), that is not ours to undo.
            if (el.selectionStart === el.selectionEnd) el.setSelectionRange(back, back)
          })
          caretAfter.current = null
        }
        onChange(next)
      }}
    />
  )
}
