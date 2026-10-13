'use client'

import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
  type Ref,
} from 'react'

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

/** Commas in the whole-peso part only, the rest exactly as typed:
 * "12345" → "12,345", "12345." → "12,345.", "12345.6" → "12,345.6". */
export function groupThousands(plain: string): string {
  const dot = plain.indexOf('.')
  const whole = dot === -1 ? plain : plain.slice(0, dot)
  const rest = dot === -1 ? '' : plain.slice(dot)
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + rest
}

/** Where the caret goes in `formatted` so it sits after the same `count`
 * digits (and ".") it sat after before the commas moved. */
function caretAfter(formatted: string, count: number): number {
  if (count <= 0) return 0
  let seen = 0
  for (let i = 0; i < formatted.length; i++) {
    if (formatted[i] !== ',') seen++
    if (seen === count) return i + 1
  }
  return formatted.length
}

/** The value as plain text: no commas, no forced trailing zeros. */
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

/** The plain text after one keystroke, and how many of its characters sit
 * before the caret. Backspace/Delete on a comma removes the digit beside it —
 * otherwise the comma would just come straight back and the key would seem
 * dead. */
function readKeystroke(
  e: ChangeEvent<HTMLInputElement>,
  previous: string
): { plain: string; before: number } {
  const el = e.target
  const caret = el.selectionStart ?? el.value.length
  const plain = sanitizeMoney(el.value)
  const before = sanitizeMoney(el.value.slice(0, caret)).length
  if (plain !== previous) return { plain, before }
  const inputType = (e.nativeEvent as InputEvent).inputType
  if (inputType === 'deleteContentBackward' && before > 0) {
    return { plain: plain.slice(0, before - 1) + plain.slice(before), before: before - 1 }
  }
  if (inputType === 'deleteContentForward' && before < plain.length) {
    return { plain: plain.slice(0, before) + plain.slice(before + 1), before }
  }
  return { plain, before }
}

function assignRef(ref: Ref<HTMLInputElement> | undefined, el: HTMLInputElement | null): void {
  if (typeof ref === 'function') ref(el)
  else if (ref) ref.current = el
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
 * The peso amount input for POS (Scenario 71, item 2). Commas appear as the
 * cashier types ("25000" reads "25,000" straight away) and the caret stays
 * where they were typing; leaving the field adds the centavos ("25,000.00")
 * and rounds to them. A typed "." or "12.0" survives — the field keeps the
 * text being typed rather than turning it into a number and echoing it back.
 * Commas never reach the parent, the API or the clipboard: the parent only
 * ever sees plain text it can `Number()`.
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
  // What the cashier is typing (plain, no commas) while the field has focus.
  const [draft, setDraft] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Characters (digits and ".") the caret should sit after once React has
  // re-rendered the field with its commas moved.
  const pendingCaret = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = inputRef.current
    if (pendingCaret.current === null || !el || draft === null) return
    const at = caretAfter(el.value, pendingCaret.current)
    pendingCaret.current = null
    el.setSelectionRange(at, at)
  })

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

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const { plain, before } = readKeystroke(e, draft ?? toPlain(value))
    pendingCaret.current = before
    setDraft(plain)
    onValueChange(plain)
  }

  return (
    <input
      {...rest}
      ref={(el) => {
        inputRef.current = el
        assignRef(ref, el)
      }}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={draft === null ? toDisplay(value) : groupThousands(draft)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
    />
  )
}
