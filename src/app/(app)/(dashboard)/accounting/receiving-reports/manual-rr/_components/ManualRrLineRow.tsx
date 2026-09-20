'use client'

/* Scenario 53 (2nd pass) — one line's costing UI, split out of ManualRrForm.tsx
 * because a line's own discount chain needs its own useFieldArray, which
 * (per PurchaseOrderFormFields.tsx's own comment on the same constraint)
 * only React Hook Form allows from within a genuinely separate component.
 * Mirrors that PO line grid's SRP → Discounts → Unit Price → Line Total →
 * Free columns and interactions, adapted for Manual RR's own needs: a
 * Catalog/"Something else" item toggle POs don't have, and per-line serial
 * capture POs don't have either (serials are captured at receiving time,
 * not ordering time).
 */

import { useEffect, useState } from 'react'
import {
  Controller,
  useFieldArray,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormSetValue,
} from 'react-hook-form'
import { ChevronDown, ChevronUp, Copy, Trash2 } from 'lucide-react'
import {
  MANUAL_RR_TAX_CODES,
  MANUAL_RR_WITHHOLDING_CLASSES,
  type CreateManualReceivingReportFormValues,
  type ManualReceivingReportLineFormValues,
} from '@/src/schema/inventory/manual-receiving-reports'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import Tooltip from '@/src/components/ui/Tooltip'
import { MONO } from '../../../../inventory/purchase-orders/_components/procurementTokens'
import {
  INPUT,
  INPUT_BAD,
} from '../../../../inventory/purchase-orders/_components/receive-po/receiveTokens'
import { ItemSearchCombobox } from '../../../../inventory/purchase-requests/_components/ItemSearchCombobox'
import { costFromPricing, lineTotal } from './manualRrCosting'

const fmtPeso = (n: number) =>
  n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const TAX_CODE_SHORT: Record<string, string> = {
  '': 'None',
  VAT: 'VAT',
  NON_VAT: 'Non-VAT',
  EXEMPT: 'Exempt',
}
const WITHHOLDING_SHORT: Record<string, string> = {
  '': 'None',
  goods: 'Goods',
  services: 'Services',
}

type Props = {
  control: Control<CreateManualReceivingReportFormValues>
  setValue: UseFormSetValue<CreateManualReceivingReportFormValues>
  index: number
  mode: 'catalog' | 'other'
  onSetMode: (mode: 'catalog' | 'other') => void
  itemName?: string
  isSerialTracked: boolean
  trackSerial: boolean
  onToggleTrackSerial: () => void
  onSelectCatalogItem: (option: SearchComboboxOption) => void
  onQuantityChange: (raw: number) => void
  onSerialChange: (unitIndex: number, value: string) => void
  onDuplicate: () => void
  onRemove: () => void
  lineErrors?: FieldErrors<ManualReceivingReportLineFormValues>
}

export default function ManualRrLineRow({
  control,
  setValue,
  index,
  mode,
  onSetMode,
  itemName,
  isSerialTracked,
  trackSerial,
  onToggleTrackSerial,
  onSelectCatalogItem,
  onQuantityChange,
  onSerialChange,
  onDuplicate,
  onRemove,
  lineErrors,
}: Props) {
  const line = useWatch({ control, name: `lines.${index}` })
  const qty = Number(line?.quantityReceived) || 0
  const {
    fields: discountFields,
    append: appendDiscount,
    remove: removeDiscount,
  } = useFieldArray({ control, name: `lines.${index}.discounts` })
  const hasSrp = !!line?.srp
  const [stackOpen, setStackOpen] = useState(false)
  // Collapsed by default even when the line already carries a document
  // default (VAT/Goods etc.) — same convention stackOpen uses for
  // discounts: the summary chip is enough, the editor is only for an
  // override.
  const [taxOpen, setTaxOpen] = useState(false)
  const taxSummary = `${TAX_CODE_SHORT[line?.taxCode ?? ''] ?? 'None'} · ${
    WITHHOLDING_SHORT[line?.withholdingClass ?? ''] ?? 'None'
  }`

  // Unit Price follows the SRP → discount chain, the same rule the PO form
  // applies — but only once an SRP is actually set. A hand-typed cost (the
  // common case for a "Something else" line with no catalog SRP) is never
  // overwritten.
  const pricingKey = JSON.stringify([line?.srp, line?.discounts, line?.isFreebie])
  useEffect(() => {
    const next = costFromPricing({
      srp: line?.srp,
      discounts: line?.discounts,
      isFreebie: line?.isFreebie,
    })
    if (next == null || next === Number(line?.unitCost)) return
    setValue(`lines.${index}.unitCost`, next, { shouldValidate: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingKey])

  function toggleFreebie() {
    const next = !line?.isFreebie
    setValue(`lines.${index}.isFreebie`, next, { shouldValidate: false })
    if (next) setValue(`lines.${index}.unitCost`, 0, { shouldValidate: false })
  }

  const total = lineTotal({
    quantityReceived: line?.quantityReceived ?? 0,
    unitCost: line?.unitCost,
    isFreebie: line?.isFreebie,
  })

  const discountCount = discountFields.length

  return (
    <div className="border-b border-[#eeeef1] px-4.5 py-3.5 last:border-b-0">
      <div className="mb-1 flex items-center gap-1.5">
        <button
          type="button"
          className={toggleBtnClass(mode === 'catalog')}
          onClick={() => onSetMode('catalog')}
        >
          Catalog item
        </button>
        <button
          type="button"
          className={toggleBtnClass(mode === 'other')}
          onClick={() => onSetMode('other')}
        >
          Something else
        </button>
      </div>

      <div className="grid grid-cols-1 gap-x-3 gap-y-2 xl:grid-cols-[minmax(0,1fr)_64px_100px_120px_112px_96px_60px_60px] xl:items-center">
        <div className="min-w-0">
          {mode === 'catalog' ? (
            <Controller
              name={`lines.${index}.itemId`}
              control={control}
              render={({ field: f }) => (
                <ItemSearchCombobox
                  value={f.value ?? ''}
                  onChange={f.onChange}
                  initialLabel={itemName}
                  onSelect={onSelectCatalogItem}
                  compact
                  error={lineErrors?.itemId?.message}
                />
              )}
            />
          ) : (
            <Controller
              name={`lines.${index}.newItemName`}
              control={control}
              render={({ field: f }) => (
                <input
                  {...f}
                  value={f.value ?? ''}
                  type="text"
                  placeholder='What was it? e.g. "10 assorted screws"'
                  className={lineErrors?.itemId ? INPUT_BAD : INPUT}
                />
              )}
            />
          )}
          {lineErrors?.itemId && mode === 'other' && (
            <FieldError text={lineErrors.itemId.message} />
          )}
        </div>

        <Controller
          name={`lines.${index}.quantityReceived`}
          control={control}
          render={({ field: f }) => (
            <input
              type="number"
              min="0"
              step="1"
              value={f.value ?? ''}
              onChange={(e) => onQuantityChange(Number(e.target.value))}
              onBlur={f.onBlur}
              className={`${lineErrors?.quantityReceived ? INPUT_BAD : INPUT} text-right ${MONO} text-[12.5px]`}
            />
          )}
        />

        <Controller
          name={`lines.${index}.srp`}
          control={control}
          render={({ field: f }) => (
            <input
              type="number"
              step="0.01"
              min="0"
              value={f.value ?? ''}
              onChange={(e) =>
                f.onChange(e.target.value === '' ? undefined : Number(e.target.value))
              }
              onBlur={f.onBlur}
              placeholder="—"
              className={`${INPUT} text-right ${MONO} text-[12.5px]`}
            />
          )}
        />

        <div>
          <button
            type="button"
            onClick={() => {
              if (discountCount === 0) appendDiscount({ type: 'percentage', value: 0 })
              setStackOpen(true)
            }}
            className="flex w-full items-center justify-between gap-1 rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] px-2.5 py-1.5 text-[12px] font-medium text-[#3f1490] hover:bg-[#e8ddfa]"
          >
            {discountCount > 0
              ? `${discountCount} discount${discountCount === 1 ? '' : 's'}`
              : '+ Add discount'}
            {discountCount > 0 &&
              (stackOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
          </button>
        </div>

        <Controller
          name={`lines.${index}.unitCost`}
          control={control}
          render={({ field: f }) => (
            <input
              type="number"
              step="0.01"
              min="0"
              value={f.value ?? ''}
              onChange={(e) =>
                f.onChange(e.target.value === '' ? undefined : Number(e.target.value))
              }
              onBlur={f.onBlur}
              placeholder="0.00"
              disabled={!!line?.isFreebie}
              className={`${INPUT} text-right ${MONO} text-[12.5px] disabled:bg-[#f5f5f7] disabled:text-[#a3a3b2]`}
            />
          )}
        />

        <span className={`${MONO} self-center text-right text-[12.5px] text-[#17171c]`}>
          {fmtPeso(total)}
        </span>

        <label className="flex items-center justify-center gap-1 self-center">
          <input
            type="checkbox"
            checked={line?.isFreebie ?? false}
            onChange={toggleFreebie}
            className="h-4 w-4 rounded border-[#d3d3db]"
          />
        </label>

        <div className="flex items-center justify-end gap-0.5 self-center">
          <Tooltip label="Duplicate line" side="bottom" align="end">
            <button
              type="button"
              onClick={onDuplicate}
              aria-label="Duplicate line"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8b8b9b] hover:bg-[#f1f1f4] hover:text-[#3f1490]"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip label="Remove line" side="bottom" align="end">
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove line"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8b8b9b] hover:bg-[#fdeceb] hover:text-[#b42318]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="mt-2">
        <button
          type="button"
          onClick={() => setTaxOpen((v) => !v)}
          className="flex items-center gap-1 rounded-md border border-[#d3d3db] px-2 py-1 text-[11.5px] font-medium text-[#5b5b6b] hover:border-[#a3a3b2]"
        >
          Tax: {taxSummary}
          {taxOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {taxOpen && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[10px] border border-[#e4e4e9] bg-[#fbfbfc] px-3.5 py-2.5">
          <span className="text-[11px] text-[#8b8b9b]">Tax code</span>
          <Controller
            name={`lines.${index}.taxCode`}
            control={control}
            render={({ field: f }) => (
              <select
                {...f}
                value={f.value ?? ''}
                aria-label="Tax code"
                className="h-6.5 rounded-md border border-[#d3d3db] bg-white px-1.5 text-[11.5px] text-[#5b5b6b] outline-none focus:border-[#5b21b6]"
              >
                {MANUAL_RR_TAX_CODES.map((code) => (
                  <option key={code.value} value={code.value}>
                    {code.label}
                  </option>
                ))}
              </select>
            )}
          />
          <span className="text-[11px] text-[#8b8b9b]">Withholding</span>
          <Controller
            name={`lines.${index}.withholdingClass`}
            control={control}
            render={({ field: f }) => (
              <select
                {...f}
                value={f.value ?? ''}
                aria-label="Withholding"
                className="h-6.5 rounded-md border border-[#d3d3db] bg-white px-1.5 text-[11.5px] text-[#5b5b6b] outline-none focus:border-[#5b21b6]"
              >
                {MANUAL_RR_WITHHOLDING_CLASSES.map((cls) => (
                  <option key={cls.value} value={cls.value}>
                    {cls.label}
                  </option>
                ))}
              </select>
            )}
          />
        </div>
      )}

      {discountCount > 0 && stackOpen && (
        <div className="relative mt-2.5 rounded-[10px] border border-[#ddd0f7] bg-[#fcfaff] px-3.5 py-3">
          <button
            type="button"
            onClick={() => setStackOpen(false)}
            aria-label="Collapse discounts"
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-[#a3a3b2] hover:bg-white hover:text-[#3f1490]"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <div className="flex flex-col gap-1.5">
            {discountFields.map((discountField, di) => (
              <div
                key={discountField.id}
                className="grid grid-cols-[220px_44px_100px_28px] items-center gap-2"
              >
                <Controller
                  name={`lines.${index}.discounts.${di}.name`}
                  control={control}
                  render={({ field: f }) => (
                    <input
                      value={f.value ?? ''}
                      onChange={f.onChange}
                      placeholder="Discount name (optional)"
                      className="w-full rounded-[7px] border border-[#e4e4e9] bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
                    />
                  )}
                />
                <Controller
                  name={`lines.${index}.discounts.${di}.type`}
                  control={control}
                  render={({ field: f }) => (
                    <button
                      type="button"
                      onClick={() => f.onChange(f.value === 'percentage' ? 'amount' : 'percentage')}
                      className={`${MONO} w-full rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] py-1.5 text-[12px] text-[#3f1490] hover:bg-[#e8ddfa]`}
                    >
                      {f.value === 'amount' ? '₱' : '%'}
                    </button>
                  )}
                />
                <Controller
                  name={`lines.${index}.discounts.${di}.value`}
                  control={control}
                  render={({ field: f }) => (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={f.value ?? ''}
                      onChange={(e) => f.onChange(Number(e.target.value) || 0)}
                      className={`${MONO} w-full rounded-[7px] border border-[#e4e4e9] bg-white px-2.5 py-1.5 text-right text-[12.5px] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]`}
                    />
                  )}
                />
                <button
                  type="button"
                  onClick={() => removeDiscount(di)}
                  aria-label="Remove discount"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-[#8b8b9b] hover:bg-[#fdeceb] hover:text-[#b42318]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => appendDiscount({ type: 'percentage', value: 0 })}
            className="mt-2 text-[11.5px] font-medium text-[#3f1490] hover:underline"
          >
            + Add another discount
          </button>
          {!hasSrp && (
            <p className="mt-1.5 text-[11px] text-[#8b8b9b]">
              Set an SRP above for the discount chain to compute a Unit Price.
            </p>
          )}
        </div>
      )}

      {mode === 'other' && (
        <label className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-[#5b5b6b]">
          <input
            type="checkbox"
            checked={trackSerial}
            onChange={onToggleTrackSerial}
            className="h-3.5 w-3.5 rounded border-[#d3d3db]"
          />
          Track by serial number
        </label>
      )}

      {isSerialTracked && qty > 0 && (
        <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: qty }, (_, unitIndex) => {
            const serialError = lineErrors?.serialNumbers?.[unitIndex]?.message
            return (
              <input
                key={unitIndex}
                type="text"
                value={line?.serialNumbers?.[unitIndex] ?? ''}
                onChange={(e) => onSerialChange(unitIndex, e.target.value)}
                placeholder={`Serial ${unitIndex + 1}`}
                className={serialError ? INPUT_BAD : `${INPUT} ${MONO} text-[12px]`}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function FieldError({ text }: { text?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-[#b42318]">
      <span className="inline-block h-1.25 w-1.25 rounded-full bg-[#b42318]" />
      {text}
    </span>
  )
}

const toggleBtnClass = (active: boolean) =>
  `shrink-0 rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors ${
    active
      ? 'border-[#ddd0f7] bg-[#f1ebfb] text-[#3f1490]'
      : 'border-[#d3d3db] text-[#5b5b6b] hover:border-[#a3a3b2]'
  }`
