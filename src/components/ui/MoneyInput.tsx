'use client'

import { useState, type FocusEvent, type InputHTMLAttributes, type Ref } from 'react'

/** Keep digits and the first decimal point only. A pasted "₱6,190.00" becomes
 * "6190.00"; letters, a minus sign and a second "." never get in. */
export function sanitizeMoney(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const dot = cleaned.indexOf('.')
  if (dot === -1) return cleaned
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '')
}

/** Round half up to centavos, so 0.005 is 0.01 rather than float's 0.00. */
function roundCentavos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** "12,345.60" — two decimals, with thousands separators. */
export function formatMoney(n: number): string {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** The value as plain text for editing: no commas, no forced trailing zeros. */
function toPlain(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return typeof value === 'number' ? String(value) : sanitizeMoney(value)
}

function toDisplay(value: string | number | null | undefined): string {
  const plain = toPlain(value)
  if (plain === '' || plain === '.') return ''
  const n = Number(plain)
  return Number.isFinite(n) ? formatMoney(n) : plain
}

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'inputMode' | 'defaultValue'
> & {
  /** A number, or a plain/comma-formatted numeric string. '' (or null) is blank. */
  value: string | number | null | undefined
  /** Plain numeric text, never a comma: "12345.6", or '' when cleared. Blank is
   * handed back as-is so a field where blank means something (a free
   * delivery) can tell it apart from 0. */
  onValueChange: (plain: string) => void
  ref?: Ref<HTMLInputElement>
}

/**
 * The peso amount input for POS (Scenario 71, item 2). It reads "12,345.67"
 * when not focused and takes raw keystrokes while focused, so a typed "." or
 * "12.0" survives instead of being turned into a number and echoed back.
 * Commas never reach the parent, the API or the clipboard — the parent only
 * ever sees plain text it can `Number()`. On blur the amount is rounded to
 * centavos.
 *
 * Styling is the caller's: pass the same classes the field had before.
 */
export function MoneyInput({
  value,
  onValueChange,
  onFocus,
  onBlur,
  placeholder = '0.00',
  ref,
  ...rest
}: Props): React.ReactElement {
  // What the cashier is typing, verbatim, while the field has focus.
  const [draft, setDraft] = useState<string | null>(null)

  const handleFocus = (e: FocusEvent<HTMLInputElement>): void => {
    setDraft(toPlain(value))
    onFocus?.(e)
  }

  const handleBlur = (e: FocusEvent<HTMLInputElement>): void => {
    const plain = draft ?? toPlain(value)
    setDraft(null)
    const n = Number(plain)
    if (plain !== '' && plain !== '.' && Number.isFinite(n)) {
      const rounded = String(roundCentavos(n))
      if (rounded !== plain) onValueChange(rounded)
    } else if (plain === '.') {
      onValueChange('')
    }
    onBlur?.(e)
  }

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={draft ?? toDisplay(value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={(e) => {
        const plain = sanitizeMoney(e.target.value)
        setDraft(plain)
        onValueChange(plain)
      }}
    />
  )
}
