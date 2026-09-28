'use client'

import { useEffect, useRef, useState } from 'react'
import PhoneInput, { parsePhoneNumber } from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

/**
 * PhoneInput's `value` must be E.164 (leading '+') or undefined, or it logs a
 * console error on every mount. Numbers captured before these forms used
 * PhoneInput are plain local strings ("09170004321"), so best-effort re-parse
 * them as PH and hand back E.164; undefined otherwise, which renders empty
 * while the underlying form value keeps the raw string.
 */
export function toDisplayPhoneValue(raw: string): string | undefined {
  if (!raw) return undefined
  if (raw.startsWith('+')) return raw
  try {
    const parsed = parsePhoneNumber(raw, 'PH')
    return parsed?.isValid() ? parsed.number : undefined
  } catch {
    return undefined
  }
}

/** Just the country code and nothing typed — not a real value to capture. */
function isEmptyish(v: string): boolean {
  const digits = v.replace(/[^\d+]/g, '')
  return !digits || digits === '+' || digits === '+63'
}

type Props = {
  value: string
  onChange: (next: string) => void
  className?: string
  /** Rendered under the control by the caller; accepted so the wrapper can
   * still own layout without every call site re-wrapping it. */
  disabled?: boolean
}

/**
 * PH phone input, shared by every form that captures a number.
 *
 * **Why this exists rather than four copies of `<PhoneInput>`:** a browser
 * autofill (or password manager) assigns `input.value` directly. React's own
 * value tracker is updated by that assignment, so the `input` event which
 * follows looks like a no-op and `onChange` never fires — the number is
 * visible on screen but the form holds ''. Worse, the next render pushes the
 * empty form value back in and the control visibly collapses to "+63",
 * discarding what the user saw themselves put in.
 *
 * That was invisible while every phone field was optional. Scenario 60 Part 4
 * made the co-maker's number required, and it surfaced immediately as
 * "Contact number is required" over a filled-looking box — reproduced in an
 * e2e harness before this fix: typed input captured fine, autofilled input
 * did not.
 *
 * The rescue is to stop relying on the change event alone and read the DOM
 * back on blur and shortly after mount (autofill commonly lands on page
 * load), pushing the value up if the form is out of step. Anything React did
 * see still flows through `onChange` as before.
 */
export function PhoneField({ value, onChange, className, disabled }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)

  // The control owns what is displayed; the form is told about changes but
  // never dictates them back mid-edit. This is the important part: feeding
  // `value` straight into PhoneInput means any re-render where the form
  // momentarily holds '' (an unparseable partial number, a sibling field
  // updating, an autofill React did not observe) resets the box and throws
  // away what the user can see. Holding the display locally makes that
  // impossible.
  const [display, setDisplay] = useState(() => toDisplayPhoneValue(value ?? '') ?? '')
  // What we last told the parent. Anything arriving in `value` that differs
  // from this came from the parent itself — a reset when the applicant
  // changes, or a record being pre-filled — and must be honoured.
  const lastEmitted = useRef(value ?? '')

  useEffect(() => {
    const incoming = value ?? ''
    if (incoming !== lastEmitted.current) {
      lastEmitted.current = incoming
      setDisplay(toDisplayPhoneValue(incoming) ?? '')
    }
  }, [value])

  const emit = (next: string) => {
    lastEmitted.current = next
    onChange(next)
  }

  // Autofill rescue: a browser fill assigns `input.value` directly, which
  // updates React's own value tracker, so the `input` event that follows
  // looks like a no-op and onChange never fires. Read the DOM back instead.
  const syncFromDom = () => {
    const input = wrapperRef.current?.querySelector<HTMLInputElement>('input')
    if (!input) return
    const dom = input.value.trim()
    if (isEmptyish(dom)) return
    const normalised = dom.replace(/\s+/g, '')
    if (normalised !== (lastEmitted.current ?? '').replace(/\s+/g, '')) {
      setDisplay(dom)
      emit(normalised)
    }
  }

  useEffect(() => {
    // Autofill can land before or just after hydration, so probe twice.
    // Both are no-ops when the form already agrees.
    const timers = [setTimeout(syncFromDom, 300), setTimeout(syncFromDom, 1200)]
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={wrapperRef} onBlur={syncFromDom}>
      <PhoneInput
        value={display || undefined}
        defaultCountry="PH"
        international
        countryCallingCodeEditable={false}
        disabled={disabled}
        onChange={(v) => {
          const next = v ?? ''
          setDisplay(next)
          emit(next)
        }}
        numberInputProps={{ className: 'phone-input-field' }}
        className={`ph-phone-input${className ? ` ${className}` : ''}`}
      />
    </div>
  )
}
