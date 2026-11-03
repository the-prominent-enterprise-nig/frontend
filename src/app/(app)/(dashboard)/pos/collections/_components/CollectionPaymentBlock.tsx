'use client'

import { X } from 'lucide-react'
import MoneyInput from '@/src/components/ui/MoneyInput'
import { PillCombobox } from '../../checkout/_components/PillInputs'
import { DELIVERY_FEE_TENDER_LABELS, type DeliveryFeeTender } from '../../checkout/_utils/delivery'
import {
  TILE_OPTION_LABEL,
  type CollectionIssueField,
  type CollectionPaymentRow,
} from '../_utils/collection-tenders'

const fieldClass = (invalid: boolean) =>
  `w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-1 ${
    invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
      : 'border-zinc-200 focus:border-prominent-purple-500 focus:ring-prominent-purple-500'
  }`

/**
 * One payment of a collection: its method (the same buttons as POS checkout,
 * with the bank / gateway / acquirer under them), then the Amount received
 * directly below, and the bank's own reference for a transfer. Several of
 * these make a collection taken with several methods.
 */
export default function CollectionPaymentBlock({
  index,
  row,
  tiles,
  resolved,
  numbered,
  onRemove,
  invalid,
  onChange,
}: {
  index: number
  row: CollectionPaymentRow
  tiles: DeliveryFeeTender[]
  resolved: {
    tile: DeliveryFeeTender
    method: string
    options: { id: string; name: string }[]
    optionId: string | undefined
  }
  /** Several payments: each field is named by its payment. */
  numbered: boolean
  /** Only on a payment after the first. */
  onRemove?: () => void
  invalid: ReadonlySet<CollectionIssueField>
  onChange: (patch: Partial<CollectionPaymentRow>) => void
}) {
  const n = index + 1
  const optionLabel = TILE_OPTION_LABEL[resolved.tile]
  return (
    <div className="space-y-3" data-testid={`collection-payment-${index}`}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">
          Payment {n}
        </p>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove payment ${n}`}
            data-testid={`collection-payment-remove-${index}`}
            className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-red-600"
          >
            <X size={13} /> Remove
          </button>
        )}
      </div>

      <div
        className="rounded-lg border border-purple-100 p-2.5"
        data-testid={`collection-method-${index}`}
      >
        <div className="flex flex-wrap gap-1.5">
          {tiles.map((tile) => (
            <button
              key={tile}
              type="button"
              aria-pressed={resolved.tile === tile}
              onClick={() => onChange({ tile, optionId: '', bankReferenceNumber: '' })}
              className={`min-w-22 flex-1 rounded-lg px-2 py-1.5 text-[13px] font-semibold transition-colors ${
                resolved.tile === tile
                  ? 'bg-purple-200 text-purple-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {DELIVERY_FEE_TENDER_LABELS[tile]}
            </button>
          ))}
        </div>
        {resolved.options.length > 0 && optionLabel && (
          <PillCombobox
            ariaLabel={numbered ? `Payment ${n} ${optionLabel}` : optionLabel}
            wrapperClassName={`mt-1.5 ${invalid.has('option') ? '[&_input]:border-red-400' : ''}`}
            placeholder={`Select ${optionLabel.toLowerCase()}…`}
            options={resolved.options.map((o) => ({ value: o.id, label: o.name }))}
            value={resolved.optionId}
            onChange={(id) => onChange({ optionId: id ?? '' })}
          />
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Amount received <span className="text-red-500">*</span>
        </label>
        {/* Thousands are grouped as it is typed (32,323,232); the form still
            holds the plain number, so what is submitted is unchanged. */}
        <MoneyInput
          aria-label={numbered ? `Payment ${n} amount received` : 'Amount received'}
          data-testid={`collection-amount-${index}`}
          value={row.amount}
          onChange={(amount) => onChange({ amount })}
          // Bold, as the checkout's Amount received is.
          className={`${fieldClass(invalid.has('amount'))} font-semibold text-gray-800`}
        />
      </div>

      {resolved.method === 'BANK_TRANSFER' && (
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Reference number <span className="text-red-500">*</span>
          </label>
          <input
            aria-label={numbered ? `Payment ${n} bank reference number` : 'Reference number'}
            data-testid={`collection-bank-reference-${index}`}
            value={row.bankReferenceNumber}
            onChange={(e) => onChange({ bankReferenceNumber: e.target.value })}
            placeholder="Bank transaction reference"
            className={fieldClass(invalid.has('bankReference'))}
          />
          <p className="mt-1 text-[12px] text-zinc-400">
            Required — the bank&apos;s own transaction reference for this transfer.
          </p>
        </div>
      )}
    </div>
  )
}
