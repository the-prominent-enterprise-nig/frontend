'use client'

import type { TaxCodeOption } from '@/src/libs/data/AccountingV2Data'
import { ewtSelectOptions } from '@/src/libs/tax/ewt'

/**
 * A <select> over the tax code master's EWT codes (Scenario 69 Part D).
 *
 * A value the master no longer offers — a code switched off since a supplier or
 * a bill picked it — stays selectable as itself, so opening an old record never
 * silently swaps it for something else.
 */
export function EwtCodeSelect({
  value,
  onChange,
  options,
  loading = false,
  blankLabel,
  className,
  id,
  ariaLabel,
  disabled,
}: {
  value: string
  onChange: (code: string) => void
  options: readonly TaxCodeOption[]
  /** The list has not arrived yet — don't call the current value "gone". */
  loading?: boolean
  /** Adds a first option with an empty value, e.g. "Supplier's default". */
  blankLabel?: string
  className?: string
  id?: string
  ariaLabel?: string
  disabled?: boolean
}) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {blankLabel !== undefined && <option value="">{blankLabel}</option>}
      {ewtSelectOptions(options, value, loading).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
