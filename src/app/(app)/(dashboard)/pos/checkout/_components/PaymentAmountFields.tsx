'use client'

import { DELIVERY_FEE_CR_MAX } from '../_utils/delivery'
import type { PaymentIssueField, PaymentRow } from '../_utils/mixed-payment'

const fieldClass = (invalid: boolean) =>
  `w-full rounded-lg border-2 bg-white shadow-sm outline-none transition-colors placeholder:font-normal placeholder:text-gray-400 focus:ring-2 ${
    invalid
      ? 'border-red-400 hover:border-red-500 focus:border-red-500 focus:ring-red-200'
      : 'border-purple-200 hover:border-purple-400 focus:border-purple-500 focus:ring-purple-200'
  }`

/** A reference / CR number box, drawn as the single payment's always was. */
export function ReferenceField({
  label,
  required,
  value,
  invalid,
  onChange,
  testId,
  ariaLabel,
}: {
  label: string
  required: boolean
  value: string
  invalid: boolean
  onChange: (value: string) => void
  testId: string
  ariaLabel: string
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-800">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        aria-label={ariaLabel}
        data-testid={testId}
        className={`${fieldClass(invalid)} px-3 py-2.5 text-[13px] font-semibold text-gray-800`}
        placeholder={label}
        maxLength={DELIVERY_FEE_CR_MAX}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

/**
 * Amount received of one payment, drawn as the single payment's always is,
 * with its own reference number underneath only when its method asks for one
 * (QR/GCash/Billers, card, bank transfer — and only on a sale without a down
 * payment; a down-payment sale has a single CR instead, asked once elsewhere).
 */
export default function PaymentAmountFields({
  index,
  row,
  numbered,
  reference,
  invalid,
  onChange,
}: {
  index: number
  row: PaymentRow
  /** Several payments: each field is named by its payment. */
  numbered: boolean
  reference: { label: string; required: boolean } | null
  invalid: ReadonlySet<PaymentIssueField>
  onChange: (patch: Partial<PaymentRow>) => void
}) {
  const n = index + 1
  return (
    <div className="space-y-2" data-testid={`payment-row-${index}`}>
      <div className="space-y-1">
        <label className="block text-[13px] text-gray-700">Amount received</label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-base font-semibold text-gray-500">
            ₱
          </span>
          <input
            type="number"
            min={0}
            step={0.01}
            aria-label={numbered ? `Payment ${n} amount received` : 'Amount received'}
            data-testid={`payment-amount-${index}`}
            className={`${fieldClass(invalid.has('amount'))} py-3 pl-9 pr-3 text-base font-semibold text-gray-800 placeholder:text-sm`}
            placeholder="0.00"
            value={row.amount === 0 ? '' : row.amount}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              onChange({ amount: isNaN(val) ? 0 : val })
            }}
          />
        </div>
      </div>
      {reference && (
        <ReferenceField
          label={reference.label}
          required={reference.required}
          value={row.referenceNumber}
          invalid={invalid.has('reference')}
          onChange={(v) => onChange({ referenceNumber: v })}
          testId={`payment-reference-${index}`}
          ariaLabel={numbered ? `Payment ${n} ${reference.label}` : reference.label}
        />
      )}
    </div>
  )
}
