'use client'

import { X } from 'lucide-react'
import type { PaymentMethodConfig } from '@/src/schema/pos'
import {
  CARD_INSTALLMENT_TERMS,
  DELIVERY_FEE_CHECK_NUMBER_MAX,
  DELIVERY_FEE_TENDER_LABELS,
  deliveryFeeOptions,
  type DeliveryFeeTender,
} from '../_utils/delivery'
import type { PaymentIssueField, PaymentRow } from '../_utils/mixed-payment'
import { PillCombobox } from './PillInputs'

const OPTION_LABEL: Partial<Record<DeliveryFeeTender, string>> = {
  bank_transfer: 'Bank',
  gcash: 'Gateway',
  billers: 'Biller',
  qr: 'Gateway',
}

const pillClass = (active: boolean, activeClass = 'bg-purple-200 text-purple-700') =>
  `flex-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold transition-colors ${
    active ? activeClass : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
  }`

/**
 * One more payment method, drawn exactly as the Cash panel above it: the same
 * pills, and for the chosen one the same follow-up (bank or gateway, check
 * number, "verified at register", card acquirer with Straight / Installment).
 * Added by "Add another payment method"; the first payment keeps using the
 * panel that Payment Mode already draws.
 */
export default function TenderPanel({
  index,
  row,
  tenders,
  configuredMethods,
  invalid,
  onChange,
  onTenderChange,
  onRemove,
}: {
  index: number
  row: PaymentRow
  tenders: DeliveryFeeTender[]
  configuredMethods: PaymentMethodConfig[]
  invalid: ReadonlySet<PaymentIssueField>
  onChange: (patch: Partial<PaymentRow>) => void
  onTenderChange: (tender: DeliveryFeeTender) => void
  onRemove: () => void
}) {
  const n = index + 1
  const tender = row.tender ?? 'cash_on_hand'
  const options = deliveryFeeOptions(tender, configuredMethods)
  const optionLabel = OPTION_LABEL[tender]

  return (
    <div className="space-y-2" data-testid={`payment-panel-${index}`}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-gray-500">
          Payment {n}
        </p>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove payment ${n}`}
          data-testid={`payment-remove-${index}`}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600"
        >
          <X size={13} /> Remove
        </button>
      </div>

      <div className="rounded-lg border border-purple-100 p-2.5">
        <p className="mb-1.5 text-xs font-medium text-gray-800">Cash</p>
        <div className="flex gap-1.5">
          {tenders.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tender === t}
              onClick={() => onTenderChange(t)}
              className={pillClass(tender === t)}
            >
              {DELIVERY_FEE_TENDER_LABELS[t]}
            </button>
          ))}
        </div>

        {options.length > 0 && optionLabel && (
          <PillCombobox
            ariaLabel={`Payment ${n} ${optionLabel}`}
            wrapperClassName="mt-1.5"
            placeholder={`Select ${optionLabel.toLowerCase()}…`}
            options={options.map((o) => ({ value: o.id, label: o.name }))}
            value={row.paymentMethodOptionId}
            onChange={(optionId) =>
              onChange({
                paymentMethodOptionId: optionId,
                optionName: options.find((o) => o.id === optionId)?.name,
              })
            }
          />
        )}

        {tender === 'check' && (
          <input
            aria-label={`Payment ${n} check number`}
            data-testid={`payment-check-${index}`}
            className={`mt-1.5 w-full rounded-lg border-2 bg-white px-3 py-2.5 text-[13px] font-semibold text-gray-800 shadow-sm outline-none transition-colors placeholder:font-semibold placeholder:text-gray-600 focus:ring-2 ${
              invalid.has('check')
                ? 'border-red-400 hover:border-red-500 focus:border-red-500 focus:ring-red-200'
                : 'border-purple-200 hover:border-purple-400 focus:border-purple-500 focus:ring-purple-200'
            }`}
            placeholder="Check Number (required)"
            maxLength={DELIVERY_FEE_CHECK_NUMBER_MAX}
            value={row.checkNumber ?? ''}
            onChange={(e) => onChange({ checkNumber: e.target.value })}
          />
        )}

        {tender === 'bank_transfer' && (
          <label className="mt-1.5 flex items-center gap-1.5 text-[12px] text-gray-700">
            <input
              type="checkbox"
              checked={!!row.bankVerified}
              onChange={(e) => onChange({ bankVerified: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            Verified at register — the credit already landed, post straight to Cash in Bank
          </label>
        )}
      </div>

      {tender === 'card' && (
        <div className="rounded-lg border border-purple-100 p-2.5">
          <p className="mb-1.5 text-xs font-medium text-gray-800">Select Card Acquirer</p>
          {options.length > 0 && (
            <PillCombobox
              ariaLabel={`Payment ${n} Card Acquirer`}
              wrapperClassName="mb-1.5"
              placeholder="Select card acquirer…"
              options={options.map((o) => ({ value: o.id, label: o.name }))}
              value={row.paymentMethodOptionId}
              onChange={(optionId) =>
                onChange({
                  paymentMethodOptionId: optionId,
                  optionName: options.find((o) => o.id === optionId)?.name,
                })
              }
            />
          )}
          <div className="flex gap-1.5">
            {(['straight', 'installment'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={row.cardTxnMode === mode}
                onClick={() =>
                  onChange({
                    cardTxnMode: mode,
                    cardTerm: mode === 'straight' ? undefined : row.cardTerm,
                  })
                }
                className={pillClass(
                  row.cardTxnMode === mode,
                  mode === 'installment'
                    ? 'bg-prominent-purple-100 text-prominent-purple-700'
                    : 'bg-purple-200 text-purple-700'
                )}
              >
                {mode === 'straight' ? 'Straight' : 'Installment'}
              </button>
            ))}
          </div>
          {row.cardTxnMode === 'installment' && (
            <div data-testid={`payment-term-${index}`}>
              <PillCombobox
                ariaLabel={`Payment ${n} card term`}
                wrapperClassName="mt-1.5"
                placeholder="Select Term (required)"
                options={CARD_INSTALLMENT_TERMS.map((m) => ({
                  value: String(m),
                  label: `${m} months`,
                }))}
                value={row.cardTerm ? String(row.cardTerm) : undefined}
                onChange={(v) => onChange({ cardTerm: v ? Number(v) : undefined })}
              />
              {invalid.has('term') && (
                <p className="mt-1 text-xs text-red-600">Select a Term for the card installment.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
