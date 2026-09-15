'use client'

import { Controller, type Control } from 'react-hook-form'
import { Plus, X } from 'lucide-react'
import type { ReceiveStockFormValues } from '@/src/schema/inventory/goods-receiving'
import { MONO, fmtPeso } from '../../../purchase-orders/_components/procurementTokens'
import type { Discount } from './rrTotals'

type Props = {
  control: Control<ReceiveStockFormValues>
  lineIndex: number
  /** Live values for the read-outs — watched by the parent, not re-derived. */
  lineTotal: number
  isFreebie: boolean
  qualityHold: boolean
  canViewCost: boolean
  onToggleFreebie: () => void
  onToggleQualityHold: () => void
  onClose: () => void
}

const BOX =
  'h-[34px] w-full rounded-[7px] border border-[#d3d3db] bg-white px-2.5 text-[12.5px] text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'

const NUM = `${BOX} text-right`

const LABEL = 'text-[10px] uppercase tracking-[.08em] text-[#8b8b9b]'

const TAX_CODES = [
  { value: '', label: 'None' },
  { value: 'VAT', label: 'VAT' },
  { value: 'NON_VAT', label: 'Non-VAT' },
  { value: 'EXEMPT', label: 'Exempt' },
]

/**
 * Everything about a line that isn't the quantity: what the supplier charged
 * for it and how it should be treated once it lands.
 *
 * Folded away by default because a receiver's job at the loading bay is
 * counting units — the price was agreed before the truck left, and on most
 * deliveries nothing here needs touching. It stays one click away rather than
 * on another screen because the delivery can genuinely be priced differently
 * from the order, and that variance is exactly what the 3-way match exists to
 * surface.
 */
export function RrPricingDrawer({
  control,
  lineIndex,
  lineTotal,
  isFreebie,
  qualityHold,
  canViewCost,
  onToggleFreebie,
  onToggleQualityHold,
  onClose,
}: Props): React.ReactElement {
  return (
    <div className="flex flex-col gap-3.5 rounded-[10px] border border-[#ddd0f7] bg-[#fcfaff] px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`${MONO} text-[10px] uppercase tracking-[.09em] text-[#a3a3b2]`}>
          Line details
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-[#ddd0f7] bg-white px-2.5 py-1 text-[11.5px] text-[#5b5b6b] hover:border-[#7c4fd1] hover:text-[#3f1490]"
        >
          Close
        </button>
      </div>

      {canViewCost && (
        <>
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-3 sm:grid-cols-3 xl:grid-cols-5">
            <Field label="SRP">
              <Controller
                name={`lines.${lineIndex}.srp`}
                control={control}
                render={({ field }) => (
                  <input
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)
                    }
                    onBlur={field.onBlur}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    aria-label="SRP"
                    className={NUM}
                  />
                )}
              />
            </Field>

            <Field label="Unit cost">
              <Controller
                name={`lines.${lineIndex}.unitCost`}
                control={control}
                render={({ field }) => (
                  <input
                    value={isFreebie ? 0 : (field.value ?? '')}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)
                    }
                    onBlur={field.onBlur}
                    readOnly={isFreebie}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    aria-label="Unit cost"
                    className={`${NUM} ${isFreebie ? 'bg-[#f7f7f8] text-[#8b8b9b]' : ''}`}
                  />
                )}
              />
              <span className="text-[10.5px] text-[#a3a3b2]">
                {isFreebie ? 'Zero, billed as a freebie' : 'auto from SRP less discounts'}
              </span>
            </Field>

            <Field label="Tax code">
              <Controller
                name={`lines.${lineIndex}.taxCode`}
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    value={field.value ?? ''}
                    aria-label="Tax code"
                    className={`${BOX} px-1.5`}
                  >
                    {TAX_CODES.map((code) => (
                      <option key={code.value} value={code.value}>
                        {code.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            </Field>

            <Field label="Tax amount">
              <Controller
                name={`lines.${lineIndex}.taxAmount`}
                control={control}
                render={({ field }) => (
                  <input
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)
                    }
                    onBlur={field.onBlur}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    aria-label="Tax amount"
                    className={NUM}
                  />
                )}
              />
            </Field>

            <Field label="Line total">
              <div className="flex h-[34px] items-center justify-end rounded-[7px] border border-[#e4e4e9] bg-[#f7f7f8] px-2.5">
                <span className={`${MONO} text-[12.5px] font-semibold text-[#3d3d4a]`}>
                  {fmtPeso(lineTotal)}
                </span>
              </div>
            </Field>
          </div>

          <Controller
            name={`lines.${lineIndex}.discounts`}
            control={control}
            render={({ field }) => {
              const chain = (field.value ?? []) as Discount[]
              const setChain = (next: Discount[]): void =>
                field.onChange(next.length > 0 ? next : undefined)
              return (
                <div className="flex flex-col gap-2 border-t border-[#eeeef1] pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <span className={LABEL}>Discounts off SRP</span>
                    <button
                      type="button"
                      onClick={() =>
                        setChain([...chain, { name: undefined, type: 'percentage', value: 0 }])
                      }
                      className="flex items-center gap-1 rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] px-2.5 py-1 text-[11.5px] font-medium text-[#3f1490] hover:bg-[#e8ddfa]"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>

                  {chain.length === 0 && (
                    <span className="text-[11.5px] text-[#8b8b9b]">
                      None. The unit cost above is what the supplier charged.
                    </span>
                  )}

                  {chain.map((discount, di) => (
                    <div
                      key={di}
                      className="grid grid-cols-[minmax(0,1fr)_60px_96px_30px] items-center gap-1.5"
                    >
                      <input
                        value={discount.name ?? ''}
                        onChange={(e) => {
                          const next = chain.slice()
                          next[di] = { ...discount, name: e.target.value }
                          setChain(next)
                        }}
                        type="text"
                        maxLength={100}
                        placeholder="Discount name"
                        aria-label="Discount name"
                        className={BOX}
                      />
                      <select
                        value={discount.type}
                        onChange={(e) => {
                          const next = chain.slice()
                          next[di] = { ...discount, type: e.target.value as Discount['type'] }
                          setChain(next)
                        }}
                        aria-label="Discount type"
                        className={`${BOX} px-1`}
                      >
                        <option value="percentage">%</option>
                        <option value="amount">₱</option>
                      </select>
                      <input
                        value={Number.isFinite(discount.value) ? discount.value : ''}
                        onChange={(e) => {
                          const next = chain.slice()
                          next[di] = {
                            ...discount,
                            value: Number.isNaN(e.target.valueAsNumber)
                              ? 0
                              : e.target.valueAsNumber,
                          }
                          setChain(next)
                        }}
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label="Discount value"
                        className={NUM}
                      />
                      <button
                        type="button"
                        onClick={() => setChain(chain.filter((_, n) => n !== di))}
                        aria-label="Remove discount"
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] text-[#a3a3b2] hover:bg-[#fdeceb] hover:text-[#b42318]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )
            }}
          />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2.5 border-t border-[#eeeef1] pt-3">
        <Toggle
          on={isFreebie}
          onClick={onToggleFreebie}
          label={isFreebie ? 'Freebie, no cost' : 'Mark as freebie'}
          tone="green"
        />
        <Toggle
          on={qualityHold}
          onClick={onToggleQualityHold}
          label={qualityHold ? 'On quality hold' : 'Hold for QC'}
          tone="amber"
        />
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  )
}

function Toggle({
  on,
  onClick,
  label,
  tone,
}: {
  on: boolean
  onClick: () => void
  label: string
  tone: 'green' | 'amber'
}): React.ReactElement {
  const active =
    tone === 'green'
      ? 'border-[#cfe9dd] bg-[#e7f5ef] text-[#0b6644]'
      : 'border-[#f7dfc0] bg-[#fdf3e7] text-[#8a4b06]'
  const box = tone === 'green' ? 'border-[#0f7b52] bg-[#0f7b52]' : 'border-[#b25e09] bg-[#b25e09]'
  return (
    <button
      type="button"
      onClick={onClick}
      role="checkbox"
      aria-checked={on}
      className={`flex h-[34px] shrink-0 items-center gap-2 rounded-lg border px-3 text-[12.5px] ${
        on ? `${active} font-semibold` : 'border-[#d3d3db] bg-white text-[#3d3d4a]'
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-[4px] border text-[9px] font-bold text-white ${
          on ? box : 'border-[#d3d3db] bg-white text-transparent'
        }`}
      >
        ✓
      </span>
      {label}
    </button>
  )
}
