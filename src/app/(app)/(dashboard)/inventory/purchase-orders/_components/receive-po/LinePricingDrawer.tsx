'use client'

import { Controller, type Control } from 'react-hook-form'
import { Pencil, Plus, X } from 'lucide-react'
import { MONO } from '../procurementTokens'
import { fmtPeso } from './receiveTotals'
import type { ReceivePoFormValues } from './receiveSchema'

type Discount = { name?: string; type: 'percentage' | 'amount'; value: number }

type Props = {
  control: Control<ReceivePoFormValues>
  lineIndex: number
  srp?: number
  discounts: Discount[]
  unitCost?: number
  lineTotal: number
  editing: boolean
  onToggleEdit: () => void
  onClose: () => void
}

const BOX =
  'rounded-lg border border-[#e4e4e9] bg-white px-2 py-1.5 text-[13px] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'

const LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-[#8b8b9b]'

/**
 * The agreed pricing carried over from the PO, and the means to correct it.
 *
 * Read-only until Edit is pressed on purpose: a row of open boxes invites a
 * stray keystroke into a cost that is already right, and most receipts are
 * confirmed exactly as the PO priced them. But it stays editable — the
 * delivery can genuinely be priced differently from the PO, and that variance
 * is precisely what the 3-way match exists to surface.
 */
export function LinePricingDrawer({
  control,
  lineIndex,
  srp,
  discounts,
  unitCost,
  lineTotal,
  editing,
  onToggleEdit,
  onClose,
}: Props) {
  return (
    <div className="rounded-[10px] border border-[#ddd0f7] bg-[#fcfaff] px-4 py-3.5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className={`${MONO} text-[10px] uppercase tracking-[.09em] text-[#a3a3b2]`}>
            Pricing from the purchase order
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleEdit}
              className="flex items-center gap-1 rounded-md border border-[#ddd0f7] bg-white px-2.5 py-1 text-[11.5px] font-medium text-[#3f1490] hover:bg-[#f1ebfb]"
            >
              <Pencil className="h-3 w-3" />
              {editing ? 'Done' : 'Edit'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#ddd0f7] bg-white px-2.5 py-1 text-[11.5px] text-[#5b5b6b] hover:border-[#7c4fd1] hover:text-[#3f1490]"
            >
              Close
            </button>
          </div>
        </div>

        {!editing && (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
              <Readout label="SRP" value={srp != null ? fmtPeso(srp) : '—'} />
              <Readout
                label="Discounts"
                value={discountSummary(discounts)}
                tone={discounts.length > 0 ? 'text-[#0b6644]' : undefined}
              />
              <Readout
                label="Unit cost"
                value={unitCost != null ? fmtPeso(unitCost) : '—'}
                strong
              />
              <Readout label="Line total this delivery" value={fmtPeso(lineTotal)} strong />
            </div>
            <span className="text-[11px] text-[#8b8b9b]">
              Unit cost follows SRP through the discount chain. Press Edit if the delivery is priced
              differently from the PO — the variance is what the 3-way match is for.
            </span>
          </>
        )}

        {editing && (
          <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
            <label className="flex flex-col gap-1">
              <span className={LABEL}>SRP</span>
              <Controller
                name={`lines.${lineIndex}.srp`}
                control={control}
                render={({ field }) => (
                  <input
                    value={field.value == null || isNaN(field.value) ? '' : field.value}
                    onChange={(e) => {
                      const next = e.target.valueAsNumber
                      field.onChange(Number.isNaN(next) ? undefined : next)
                    }}
                    onBlur={field.onBlur}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className={`${BOX} w-28`}
                  />
                )}
              />
            </label>

            <Controller
              name={`lines.${lineIndex}.discounts`}
              control={control}
              render={({ field }) => {
                const chain = ((field.value ?? []) as Discount[]).slice()
                const setChain = (next: Discount[]) =>
                  field.onChange(next.length ? next : undefined)
                return (
                  <div className="flex flex-col gap-1">
                    <span className={LABEL}>
                      Discounts <span className="normal-case tracking-normal">(off SRP)</span>
                    </span>
                    {chain.map((discount, di) => (
                      <div key={di} className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="Discount name"
                          maxLength={100}
                          aria-label="Discount name"
                          value={discount.name ?? ''}
                          onChange={(e) => {
                            const next = chain.slice()
                            next[di] = { ...discount, name: e.target.value }
                            setChain(next)
                          }}
                          className={`${BOX} w-40`}
                        />
                        <select
                          aria-label="Discount type"
                          value={discount.type}
                          onChange={(e) => {
                            const next = chain.slice()
                            next[di] = {
                              ...discount,
                              type: e.target.value as 'percentage' | 'amount',
                            }
                            setChain(next)
                          }}
                          className={`${BOX} w-16`}
                        >
                          <option value="percentage">%</option>
                          <option value="amount">₱</option>
                        </select>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          aria-label="Discount value"
                          placeholder={discount.type === 'amount' ? 'Amount' : 'Percent'}
                          value={Number.isFinite(discount.value) ? discount.value : ''}
                          onChange={(e) => {
                            const v = e.target.valueAsNumber
                            const next = chain.slice()
                            next[di] = { ...discount, value: Number.isNaN(v) ? 0 : v }
                            setChain(next)
                          }}
                          className={`${BOX} w-24`}
                        />
                        <button
                          type="button"
                          aria-label="Remove discount"
                          onClick={() => setChain(chain.filter((_, n) => n !== di))}
                          className="rounded-lg p-1 text-[#a3a3b2] hover:bg-[#fdeceb] hover:text-[#b42318]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setChain([...chain, { name: undefined, type: 'percentage', value: 0 }])
                      }
                      className="flex items-center gap-1 text-[13px] font-medium text-[#5b21b6] hover:underline"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                )
              }}
            />

            <label className="flex flex-col gap-1">
              <span className={LABEL}>Unit cost</span>
              <Controller
                name={`lines.${lineIndex}.unitCost`}
                control={control}
                render={({ field }) => (
                  <input
                    value={field.value == null || isNaN(field.value) ? '' : field.value}
                    onChange={(e) => {
                      const next = e.target.valueAsNumber
                      field.onChange(Number.isNaN(next) ? undefined : next)
                    }}
                    onBlur={field.onBlur}
                    type="number"
                    min="0"
                    step="0.01"
                    className={`${BOX} w-28`}
                  />
                )}
              />
              <span className="text-[11px] text-[#a3a3b2]">auto from SRP &minus; discounts</span>
            </label>

            <label className="flex flex-col gap-1">
              <span className={LABEL}>Tax</span>
              <div className="flex items-center gap-1">
                <Controller
                  name={`lines.${lineIndex}.taxCode`}
                  control={control}
                  render={({ field }) => (
                    <select
                      {...field}
                      value={field.value ?? ''}
                      aria-label="Tax code"
                      className={`${BOX} px-1`}
                    >
                      <option value="">—</option>
                      <option value="VAT">VAT</option>
                      <option value="NON_VAT">Non-VAT</option>
                      <option value="EXEMPT">Exempt</option>
                    </select>
                  )}
                />
                <Controller
                  name={`lines.${lineIndex}.taxAmount`}
                  control={control}
                  render={({ field }) => (
                    <input
                      value={field.value == null || isNaN(field.value) ? '' : field.value}
                      onChange={(e) => {
                        const next = e.target.valueAsNumber
                        field.onChange(Number.isNaN(next) ? undefined : next)
                      }}
                      onBlur={field.onBlur}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      aria-label="Tax amount"
                      className={`${BOX} w-24`}
                    />
                  )}
                />
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

/** "−6%" / "−6% then ₱500" — the whole chain, so a second discount can't
 * hide behind the first. */
function discountSummary(discounts: Discount[]): string {
  if (discounts.length === 0) return 'None'
  return discounts
    .map((d) => {
      const shown = d.type === 'amount' ? fmtPeso(Number(d.value)) : `${d.value}%`
      return d.name ? `${d.name} ${shown}` : `−${shown}`
    })
    .join(' then ')
}

function Readout({
  label,
  value,
  strong,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-[#8b8b9b]">{label}</span>
      <span
        className={`${MONO} text-[12.5px] ${strong ? 'font-semibold' : ''} ${tone ?? 'text-[#17171c]'}`}
      >
        {value}
      </span>
    </div>
  )
}
