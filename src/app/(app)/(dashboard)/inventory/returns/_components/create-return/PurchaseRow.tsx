'use client'

import { Check } from 'lucide-react'
import {
  DISPOSITION_META,
  RETURN_REASONS,
  RETURN_WINDOW_DAYS,
  type CustomerPurchase,
  type CustomerReturnLineFormValues,
  type ReturnDisposition,
} from '@/src/schema/inventory/returns'
import DispositionGrid from './DispositionGrid'
import ReplacementPicker from './ReplacementPicker'
import FaultNoteCard from './FaultNoteCard'
import { useReplacementUnits } from './useReplacementUnits'
import { INPUT, INPUT_BAD, LABEL, MONO, fmtPeso } from './returnTokens'

type Props = {
  purchase: CustomerPurchase
  /** Present exactly when this purchase is ticked. */
  line?: CustomerReturnLineFormValues
  warehouseId: string
  /** True once Post has been pressed, so unanswered questions may go red. */
  showError: boolean
  first: boolean
  onToggle: () => void
  onChange: (patch: Partial<CustomerReturnLineFormValues>) => void
}

/** Whole days between the sale and today. */
export function daysSince(iso: string): number {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return 0
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000))
}

const CHIP = `${MONO} rounded px-[7px] py-0.5 text-[10px]`

/**
 * One thing the customer bought, and — once ticked — everything that has to be
 * decided about it.
 *
 * The decision lives inside the row rather than in a separate lines table
 * below. A clerk holding a washing machine is looking at one purchase, and the
 * old two-panel arrangement made them match a row in the picker to a row in
 * the table by name to be sure they had answered about the right one.
 */
export default function PurchaseRow({
  purchase,
  line,
  warehouseId,
  showError,
  first,
  onToggle,
  onChange,
}: Props) {
  const picked = !!line
  const days = daysSince(purchase.occurredAt)
  const outside = days > RETURN_WINDOW_DAYS
  const serialTracked = !!purchase.serialNumberId
  const soldQty = Number(purchase.quantity)

  const { units, isLoading } = useReplacementUnits({
    itemId: purchase.itemId,
    warehouseId,
    returnedSerialNumberId: purchase.serialNumberId ?? undefined,
    serialTracked,
    enabled: picked,
  })

  const disposition = line?.disposition ?? ''
  const needs = disposition ? DISPOSITION_META[disposition].needs : null
  // Narrowed here rather than at the call site: `needs === 'text'` is true for
  // exactly these three, but that is a fact about the table, not something the
  // compiler can read back out of it.
  const holdsBack =
    disposition === 'quarantine' || disposition === 'repair' || disposition === 'scrap'
      ? disposition
      : null
  const overSold = !!line && (!(line.quantity > 0) || line.quantity > soldQty)

  return (
    <div className={`${first ? '' : 'border-t border-[#f4f4f6]'} ${picked ? 'bg-[#fdfcff]' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={picked}
        className="flex w-full cursor-pointer items-start gap-[11px] px-[18px] py-[13px] text-left"
      >
        <span
          className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border ${
            picked ? 'border-[#5b21b6] bg-[#5b21b6] text-white' : 'border-[#d3d3db] bg-white'
          }`}
        >
          {picked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-[5px]">
          <span className="line-clamp-2 text-[13px] leading-[1.4] font-medium text-[#17171c]">
            {purchase.itemName ?? 'Unnamed item'}
          </span>
          <span className="flex flex-wrap items-center gap-[7px]">
            {purchase.itemSku && (
              <span className={`${MONO} text-[10.5px] text-[#5b5b6b]`}>{purchase.itemSku}</span>
            )}
            {purchase.serialNumber && (
              <span className={`${CHIP} bg-[#f1f1f4] text-[#3d3d4a]`}>{purchase.serialNumber}</span>
            )}
            <span className={`${CHIP} bg-[#f7f7f8] text-[#5b5b6b]`}>
              {purchase.salesInvoiceNumber ?? purchase.transactionNumber}
            </span>
            <span
              className={`rounded px-[7px] py-0.5 text-[10px] font-medium whitespace-nowrap ${
                outside ? 'bg-[#fdf3e7] text-[#8a4b06]' : 'bg-[#e7f5ef] text-[#0b6644]'
              }`}
            >
              {outside
                ? `${days} days ago — outside window`
                : `Sold ${new Date(purchase.occurredAt).toLocaleDateString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}`}
            </span>
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className={`${MONO} text-[13.5px] font-semibold text-[#17171c]`}>
            {fmtPeso(Number(purchase.unitPrice))}
          </span>
          <span className="text-[10px] text-[#5b5b6b]">
            {soldQty} {soldQty === 1 ? 'unit' : 'units'} sold
          </span>
        </span>
      </button>

      {picked && line && (
        <div className="flex flex-col gap-[13px] px-[18px] pb-4 sm:pl-[47px]">
          <div className="grid gap-3 md:grid-cols-[215px_minmax(0,1fr)] md:gap-x-4">
            <div className="flex min-w-0 flex-col gap-[5px]">
              <label className={LABEL}>Coming back</label>
              <div className="flex items-center gap-[9px]">
                <input
                  type="number"
                  min={0}
                  max={soldQty}
                  step="any"
                  value={Number.isFinite(line.quantity) ? line.quantity : ''}
                  onChange={(e) => onChange({ quantity: Number(e.target.value) })}
                  aria-label="Quantity coming back"
                  className={`${MONO} w-[74px] shrink-0 text-right ${overSold ? INPUT_BAD : INPUT}`}
                />
                <span className="text-[11.5px] whitespace-nowrap text-[#5b5b6b]">
                  of {soldQty} sold
                </span>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-[5px]">
              <label className={LABEL}>
                Reason <span className="text-[#b42318]">*</span>
              </label>
              <select
                value={line.reasonCode}
                onChange={(e) =>
                  onChange({
                    reasonCode: e.target.value as CustomerReturnLineFormValues['reasonCode'],
                  })
                }
                aria-label="Reason for the return"
                className={`w-full cursor-pointer ${
                  showError && !line.reasonCode ? INPUT_BAD : INPUT
                }`}
              >
                <option value="">Select a reason…</option>
                {RETURN_REASONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-[7px]">
            <label className={LABEL}>
              What happens to the unit <span className="text-[#b42318]">*</span>
            </label>
            <DispositionGrid
              value={disposition}
              onChange={(value: ReturnDisposition) =>
                onChange({
                  disposition: value,
                  // Switching away from exchange drops the unit that was going
                  // to go out, so a later switch back cannot silently reuse a
                  // choice made about a different plan.
                  replacementSerialNumberId:
                    value === 'exchange' ? line.replacementSerialNumberId : undefined,
                  // Same for the fault note: "motor seized" does not belong to
                  // a line that is now being restocked.
                  faultNote: DISPOSITION_META[value].needs === 'text' ? line.faultNote : undefined,
                })
              }
              exchangeUnavailable={serialTracked && !isLoading && units.length === 0}
              showError={showError}
            />
          </div>

          {needs === 'swap' && (
            <ReplacementPicker
              units={units}
              isLoading={isLoading}
              serialTracked={serialTracked}
              value={line.replacementSerialNumberId}
              onChange={(id) => onChange({ replacementSerialNumberId: id })}
              showError={showError}
            />
          )}

          {needs === 'text' && holdsBack && (
            <FaultNoteCard
              disposition={holdsBack}
              value={line.faultNote ?? ''}
              onChange={(value) => onChange({ faultNote: value })}
              showError={showError}
            />
          )}
        </div>
      )}
    </div>
  )
}
