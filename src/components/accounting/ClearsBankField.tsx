'use client'

import type { ReactElement } from 'react'

export type ClearedType = 'SAME_DATE' | 'LATER_DATE'

export interface ClearsBankValue {
  clearedType: ClearedType
  /** YYYY-MM-DD, or '' while not known yet. */
  clearedDate: string
}

// Same two choices, same wording as the Expense and AP voucher forms' own
// Cleared control, so every screen reads identically.
const CLEARED_OPTIONS: { value: ClearedType; label: string }[] = [
  { value: 'SAME_DATE', label: 'On the same date' },
  { value: 'LATER_DATE', label: 'On a later date' },
]

const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400'

/**
 * When a payment clears the bank. Bank Reconciliation reads this instead of
 * asking anyone to tick the payment: same date clears on the payment date; a
 * later date clears on the date given here, and stays outstanding while it is
 * still blank (a cheque not yet cashed).
 */
export default function ClearsBankField({
  id,
  value,
  onChange,
  minDate,
  disabled = false,
}: {
  id: string
  value: ClearsBankValue
  onChange: (next: ClearsBankValue) => void
  /** The payment date — a payment can't clear before it was made. */
  minDate?: string
  disabled?: boolean
}): ReactElement {
  const later = value.clearedType === 'LATER_DATE'
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block" htmlFor={`${id}-type`}>
        <span className="mb-1 block text-xs font-medium text-gray-600">Clears the bank</span>
        <select
          id={`${id}-type`}
          disabled={disabled}
          value={value.clearedType}
          onChange={(e) => {
            const clearedType = e.target.value as ClearedType
            // Back to same-date drops a date that no longer means anything.
            onChange({
              clearedType,
              clearedDate: clearedType === 'LATER_DATE' ? value.clearedDate : '',
            })
          }}
          className={INPUT_CLASS}
        >
          {CLEARED_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {later && (
        <label className="block" htmlFor={`${id}-date`}>
          <span className="mb-1 block text-xs font-medium text-gray-600">Cleared date</span>
          <input
            id={`${id}-date`}
            type="date"
            disabled={disabled}
            min={minDate}
            value={value.clearedDate}
            onChange={(e) => onChange({ ...value, clearedDate: e.target.value })}
            className={INPUT_CLASS}
          />
          <span className="mt-1 block text-[12px] text-gray-500">
            Leave blank until the bank clears it — it shows as outstanding on Bank Reconciliation
            until then.
          </span>
        </label>
      )}
    </div>
  )
}

/** The request fields for a value: a blank later date is simply not sent. */
export function clearsBankPayload(value: ClearsBankValue): {
  clearedType: ClearedType
  clearedDate?: string
} {
  return {
    clearedType: value.clearedType,
    clearedDate:
      value.clearedType === 'LATER_DATE' && value.clearedDate ? value.clearedDate : undefined,
  }
}
