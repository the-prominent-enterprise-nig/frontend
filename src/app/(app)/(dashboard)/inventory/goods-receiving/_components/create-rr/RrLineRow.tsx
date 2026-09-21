'use client'

/* Scenario 55 (Stock-side Manual RR parity) — the item picker, pricing
 * columns, and per-line actions below mirror ManualRrLineRow.tsx's own
 * layout and interaction exactly: Catalog item/Something else toggle live
 * in the row, SRP -> Discounts -> Unit Price -> Line Total -> Free grid, a
 * collapsed Tax/Withholding toggle, a duplicate-line action, and — for
 * anything serial-tracked, catalog or "Something else" alike — the serial
 * inputs always visible inline once quantity is set, never behind a
 * separate column or a toggle button. What's additive on top, kept because
 * Manual RR simply has no reason to need it, is a PO-outstanding chip, the
 * repossession/installment-account picker (a repossessed unit is a real
 * already-registered serial, which the plain inline inputs below can't
 * express — it needs its own richer picker), and a quality-hold reason.
 */

import { useState } from 'react'
import { Controller, useWatch, type Control } from 'react-hook-form'
import { ChevronDown, ChevronUp, Copy, Trash2, X } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import type { ReceiveStockFormValues } from '@/src/schema/inventory/goods-receiving'
import type { SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import {
  MANUAL_RR_TAX_CODES,
  MANUAL_RR_WITHHOLDING_CLASSES,
} from '@/src/schema/inventory/manual-receiving-reports'
import {
  InstallmentAccountSearchCombobox,
  type InstallmentAccountMeta,
} from '@/src/components/inventory/InstallmentAccountSearchCombobox'
import type { RepossessedSerialMeta } from '@/src/components/inventory/RepossessedSerialSearchCombobox'
import { ItemSearchCombobox } from '../../../purchase-requests/_components/ItemSearchCombobox'
import { MONO } from '../../../purchase-orders/_components/procurementTokens'
import { SerialCaptureDrawer } from '../../../purchase-orders/_components/receive-po/SerialCaptureDrawer'
import type {
  IssueFix,
  LineIssue,
} from '../../../purchase-orders/_components/receive-po/receiveIssues'
import { INPUT, INPUT_BAD } from './rrTokens'
import { RepossessedSerialCaptureDrawer } from './RepossessedSerialCaptureDrawer'
import { RR_LINE_GRID } from './rrTokens'
import { lineTotal as computeLineTotal, type Discount, type RrLine } from './rrTotals'

// Scenario 55 (Stock-side Manual RR parity, follow-up) — mirrors
// ManualRrLineRow.tsx's own local fmtPeso exactly: no currency symbol, only
// the number. The shared fmtPeso in procurementTokens.tsx prepends ₱, which
// is what drifted this from the reference.
const fmtNum = (n: number): string =>
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

const toggleBtnClass = (active: boolean) =>
  `shrink-0 rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors ${
    active
      ? 'border-[#ddd0f7] bg-[#f1ebfb] text-[#3f1490]'
      : 'border-[#d3d3db] text-[#5b5b6b] hover:border-[#a3a3b2]'
  }`

export type RrLineRowProps = {
  control: Control<ReceiveStockFormValues>
  lineIndex: number
  line: RrLine
  /** Scenario 55 — which of itemId/newItemName is live for this line. */
  mode: 'catalog' | 'other'
  onSetMode: (mode: 'catalog' | 'other') => void
  /** The catalog combobox's initial label, once a real item is picked —
   * SearchCombobox only knows a label after its own search resolves one. */
  itemName?: string
  isSerialTracked: boolean
  /** "4 outstanding on PO-20260910-0001" when this line came off a purchase
   * order, so the row says what it is answering to. */
  poChip?: string
  canViewCost: boolean
  showErrors: boolean
  /** The resolver's own "pick a catalog item or mark it Something else"
   * message — a truly blank line ("+ Add Line" with neither ever filled in)
   * has nothing else to surface it, since rrChecks.ts's own issue list never
   * modeled a missing item (every line always carried one, pre-Scenario 55). */
  itemError?: string
  issues: LineIssue[]
  isDuplicateSerial: (unitIndex: number) => boolean
  onSelectCatalogItem: (option: SearchComboboxOption) => void
  onQtyChange: (raw: number) => void
  onSerialChange: (unitIndex: number, value: string) => void
  onClearSerials: () => void
  /** Scenario 55 (Stock-side Manual RR parity, follow-up) — mirrors
   * ManualRrLineRow.tsx's own "Track by serial number" checkbox, only
   * offered in 'other' mode: an item this form has never catalogued has no
   * isSerialTracked flag to read, so whether it's tracked is an explicit
   * per-line choice instead. */
  onToggleTrackSerial: () => void
  onToggleFreebie: () => void
  onToggleQualityHold: () => void
  onQcReasonChange: (value: string) => void
  /** Scenario 55 Part 4 — only rendered when the header's reason is
   * `repossession`; the account this line's unit was repossessed from. */
  showInstallmentAccountPicker?: boolean
  installmentAccountLabel?: string
  onInstallmentAccountChange: (id: string, meta?: InstallmentAccountMeta, label?: string) => void
  /** Scenario 55 Part 4 — per-unit display labels for existingSerialNumberIds
   * (SearchCombobox only knows a label once picked, same reason
   * installmentAccountLabel exists). */
  existingSerialLabels?: Record<number, string>
  onExistingSerialChange: (
    unitIndex: number,
    id: string,
    meta?: RepossessedSerialMeta,
    label?: string
  ) => void
  /** Scenario 55 (Stock-side Manual RR parity, follow-up) — mirrors
   * ManualRrForm.tsx's own duplicateLine(): inserts a copy right after this
   * line. The copy's mode/serial-tracked-ness is inferred from its copied
   * itemId/newItemName/serialNumbers by the same fallback logic that
   * already reads a fresh line's — no extra bookkeeping needed for a
   * field.id that doesn't exist until the next render. */
  onDuplicate: () => void
  onRemove: () => void
  onFixIssue: (fix: IssueFix) => void
}

/**
 * One received line: which item (or, for anything not in the catalog, what
 * it's called), how many, what it cost, and how it's taxed — plus whatever
 * this specific line needs to actually land as real stock (a serial per
 * unit, which account it was repossessed from, a reason it's on hold).
 */
export function RrLineRow(props: RrLineRowProps): React.ReactElement {
  const {
    control,
    lineIndex,
    line,
    mode,
    onSetMode,
    itemName,
    isSerialTracked,
    poChip,
    canViewCost,
    showErrors,
    itemError,
    issues,
    isDuplicateSerial,
    onSelectCatalogItem,
    onQtyChange,
    onSerialChange,
    onClearSerials,
    onToggleTrackSerial,
    onToggleFreebie,
    onToggleQualityHold,
    onQcReasonChange,
    showInstallmentAccountPicker,
    installmentAccountLabel,
    onInstallmentAccountChange,
    existingSerialLabels,
    onExistingSerialChange,
    onDuplicate,
    onRemove,
    onFixIssue,
  } = props

  const watched = useWatch({ control, name: `lines.${lineIndex}` })
  const qty = Number(watched?.quantityReceived) || 0
  const total = computeLineTotal(line)
  const hasError = issues.some((issue) => issue.kind === 'error')
  const [taxOpen, setTaxOpen] = useState(false)
  const [discountsOpen, setDiscountsOpen] = useState(false)
  const discountCount = (watched?.discounts ?? []).length
  const hasSrp = !!watched?.srp
  const taxSummary = `${TAX_CODE_SHORT[watched?.taxCode ?? ''] ?? 'None'} · ${
    WITHHOLDING_SHORT[watched?.withholdingClass ?? ''] ?? 'None'
  }`

  return (
    <div
      className={`border-t border-[#f1f1f4] px-3.5 py-3.5 lg:px-4.5 ${
        hasError ? 'bg-[#fffbfa]' : 'bg-white'
      }`}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        {/* Scenario 55 Part 4 — a repossessed unit is always an
            already-registered serial on a real catalog item; "Something
            else" has no existing serial to link, so the toggle doesn't even
            offer it for this reason. */}
        {!showInstallmentAccountPicker && (
          <>
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
          </>
        )}
        {poChip && (
          <span className="rounded-[4px] bg-[#f1ebfb] px-1.5 py-0.5 text-[10px] font-medium text-[#3f1490]">
            {poChip}
          </span>
        )}
        {isSerialTracked && (
          <span
            className={`${MONO} rounded-[4px] bg-[#eaf0fb] px-1.5 py-0.5 text-[9.5px] uppercase tracking-[.06em] text-[#1f4b99]`}
          >
            Serial-tracked
          </span>
        )}
        {line.isFreebie && (
          <span className="rounded-[4px] bg-[#e7f5ef] px-1.5 py-0.5 text-[10px] font-medium text-[#0b6644]">
            Freebie
          </span>
        )}
        {line.qualityHold && (
          <span className="rounded-[4px] bg-[#fdf3e7] px-1.5 py-0.5 text-[10px] font-medium text-[#8a4b06]">
            Quality hold
          </span>
        )}
      </div>

      <div className={`grid grid-cols-1 gap-x-2.5 gap-y-2 lg:items-center ${RR_LINE_GRID}`}>
        <div className="min-w-0">
          {mode === 'catalog' ? (
            <Controller
              name={`lines.${lineIndex}.itemId`}
              control={control}
              render={({ field }) => (
                <ItemSearchCombobox
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  initialLabel={itemName}
                  onSelect={onSelectCatalogItem}
                  compact
                  error={showErrors ? itemError : undefined}
                />
              )}
            />
          ) : (
            <Controller
              name={`lines.${lineIndex}.newItemName`}
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  value={field.value ?? ''}
                  type="text"
                  placeholder='What was it? e.g. "10 assorted screws"'
                  className={showErrors && itemError ? INPUT_BAD : INPUT}
                />
              )}
            />
          )}
          {mode === 'other' && showErrors && itemError && <FieldError text={itemError} />}
        </div>

        <Controller
          name={`lines.${lineIndex}.quantityReceived`}
          control={control}
          render={({ field }) => (
            <input
              type="number"
              min="0"
              step="1"
              value={field.value ?? ''}
              onChange={(e) => onQtyChange(e.target.valueAsNumber)}
              onBlur={field.onBlur}
              aria-label="Quantity received"
              className={`${showErrors && qty <= 0 ? INPUT_BAD : INPUT} text-right ${MONO} text-[12.5px]`}
            />
          )}
        />

        {canViewCost ? (
          <>
            <Controller
              name={`lines.${lineIndex}.srp`}
              control={control}
              render={({ field }) => (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  onBlur={field.onBlur}
                  placeholder="—"
                  aria-label="SRP"
                  className={`${INPUT} text-right ${MONO} text-[12.5px]`}
                />
              )}
            />

            <Controller
              name={`lines.${lineIndex}.discounts`}
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  onClick={() => {
                    if (discountCount === 0) field.onChange([{ type: 'percentage', value: 0 }])
                    setDiscountsOpen(true)
                  }}
                  className="flex w-full items-center justify-between gap-1 rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] px-2.5 py-1.5 text-[12px] font-medium text-[#3f1490] hover:bg-[#e8ddfa]"
                >
                  {discountCount > 0
                    ? `${discountCount} discount${discountCount === 1 ? '' : 's'}`
                    : '+ Add discount'}
                  {discountCount > 0 &&
                    (discountsOpen ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    ))}
                </button>
              )}
            />

            <Controller
              name={`lines.${lineIndex}.unitCost`}
              control={control}
              render={({ field }) => (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.isFreebie ? 0 : (field.value ?? '')}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  onBlur={field.onBlur}
                  readOnly={!!line.isFreebie}
                  placeholder="0.00"
                  aria-label="Unit cost"
                  className={`${INPUT} text-right ${MONO} text-[12.5px] ${
                    line.isFreebie ? 'bg-[#f5f5f7] text-[#a3a3b2]' : ''
                  }`}
                />
              )}
            />

            <span className={`${MONO} self-center text-right text-[12.5px] text-[#17171c]`}>
              {fmtNum(total)}
            </span>
          </>
        ) : (
          <>
            <span />
            <span />
            <span />
            <span />
          </>
        )}

        <label className="flex items-center justify-center gap-1 self-center">
          <input
            type="checkbox"
            checked={line.isFreebie ?? false}
            onChange={onToggleFreebie}
            aria-label="Freebie"
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
          <Tooltip
            label={line.qualityHold ? 'Remove quality hold' : 'Hold for QC'}
            side="bottom"
            align="end"
          >
            <button
              type="button"
              onClick={onToggleQualityHold}
              aria-label="Toggle quality hold"
              aria-pressed={!!line.qualityHold}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-semibold ${
                line.qualityHold
                  ? 'bg-[#fdf3e7] text-[#8a4b06] hover:bg-[#fbe8cf]'
                  : 'text-[#8b8b9b] hover:bg-[#f1f1f4] hover:text-[#8a4b06]'
              }`}
            >
              QC
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

      {canViewCost && (
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
      )}

      {canViewCost && taxOpen && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-[10px] border border-[#e4e4e9] bg-[#fbfbfc] px-3.5 py-2.5">
          <span className="text-[11px] text-[#8b8b9b]">Tax code</span>
          <Controller
            name={`lines.${lineIndex}.taxCode`}
            control={control}
            render={({ field }) => (
              <select
                {...field}
                value={field.value ?? ''}
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
            name={`lines.${lineIndex}.withholdingClass`}
            control={control}
            render={({ field }) => (
              <select
                {...field}
                value={field.value ?? ''}
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

      {canViewCost && discountCount > 0 && discountsOpen && (
        <Controller
          name={`lines.${lineIndex}.discounts`}
          control={control}
          render={({ field }) => {
            const chain = (field.value ?? []) as Discount[]
            const setChain = (next: Discount[]): void =>
              field.onChange(next.length > 0 ? next : undefined)
            return (
              <div className="relative mt-2.5 rounded-[10px] border border-[#ddd0f7] bg-[#fcfaff] px-3.5 py-3">
                <button
                  type="button"
                  onClick={() => setDiscountsOpen(false)}
                  aria-label="Collapse discounts"
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-[#a3a3b2] hover:bg-white hover:text-[#3f1490]"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <div className="flex flex-col gap-1.5">
                  {chain.map((discount, di) => (
                    <div
                      key={di}
                      className="grid grid-cols-[220px_44px_100px_28px] items-center gap-2"
                    >
                      <input
                        value={discount.name ?? ''}
                        onChange={(e) => {
                          const next = chain.slice()
                          next[di] = { ...discount, name: e.target.value }
                          setChain(next)
                        }}
                        placeholder="Discount name (optional)"
                        className="w-full rounded-[7px] border border-[#e4e4e9] bg-white px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setChain(
                            chain.map((d, i) =>
                              i === di
                                ? { ...d, type: d.type === 'percentage' ? 'amount' : 'percentage' }
                                : d
                            )
                          )
                        }
                        className={`${MONO} w-full rounded-[7px] border border-[#ddd0f7] bg-[#f1ebfb] py-1.5 text-[12px] text-[#3f1490] hover:bg-[#e8ddfa]`}
                      >
                        {discount.type === 'amount' ? '₱' : '%'}
                      </button>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={Number.isFinite(discount.value) ? discount.value : ''}
                        onChange={(e) => {
                          const next = chain.slice()
                          next[di] = { ...discount, value: Number(e.target.value) || 0 }
                          setChain(next)
                        }}
                        className={`${MONO} w-full rounded-[7px] border border-[#e4e4e9] bg-white px-2.5 py-1.5 text-right text-[12.5px] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]`}
                      />
                      <button
                        type="button"
                        onClick={() => setChain(chain.filter((_, i) => i !== di))}
                        aria-label="Remove discount"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-[#8b8b9b] hover:bg-[#fdeceb] hover:text-[#b42318]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setChain([...chain, { type: 'percentage', value: 0 }])}
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
            )
          }}
        />
      )}

      {/* The reason rides beside the hold rather than inside a drawer: a held
          line that cannot say WHY sends the inspector off to ask, and the
          whole point of holding it here is that the receiver is the one
          looking at the damage. */}
      {line.qualityHold && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 rounded-[9px] border border-[#f7dfc0] bg-[#fffdf8] px-3 py-2.5">
          <span
            className={`${MONO} shrink-0 text-[9.5px] uppercase tracking-[.09em] text-[#8a4b06]`}
          >
            QC hold reason
          </span>
          <input
            value={line.notes ?? ''}
            onChange={(e) => onQcReasonChange(e.target.value)}
            type="text"
            maxLength={500}
            placeholder="What should the inspector check?"
            aria-label="QC hold reason"
            className={`w-full flex-1 rounded-[7px] border bg-white px-2.5 py-1.5 text-[12.5px] text-[#17171c] outline-none focus:border-[#b25e09] ${
              (line.notes ?? '').trim() ? 'border-[#f7dfc0]' : 'border-[#e4e4e9]'
            }`}
          />
        </div>
      )}

      {/* Same "rides beside the row" treatment as the QC hold reason above —
          which account this unit was repossessed from is exactly the kind of
          thing the receiver needs visible while looking at the line, not
          buried in a drawer. */}
      {showInstallmentAccountPicker && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 rounded-[9px] border border-[#ddd0f7] bg-[#faf7ff] px-3 py-2.5">
          <span
            className={`${MONO} shrink-0 text-[9.5px] uppercase tracking-[.09em] text-[#3f1490]`}
          >
            Repossessed from
          </span>
          <div className="min-w-55 flex-1">
            <InstallmentAccountSearchCombobox
              value={line.installmentAccountId ?? ''}
              onChange={(id) => onInstallmentAccountChange(id)}
              onSelect={(option: SearchComboboxOption) =>
                onInstallmentAccountChange(
                  option.id,
                  option.meta as InstallmentAccountMeta,
                  option.primary
                )
              }
              initialLabel={installmentAccountLabel}
            />
          </div>
        </div>
      )}

      {/* Scenario 55 (Stock-side Manual RR parity, follow-up) — mirrors
          ManualRrLineRow.tsx's own "Track by serial number" checkbox
          exactly: only 'other' mode needs it, since a catalog item's
          isSerialTracked is already known from the item itself. */}
      {mode === 'other' && (
        <label className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-[#5b5b6b]">
          <input
            type="checkbox"
            checked={isSerialTracked}
            onChange={onToggleTrackSerial}
            className="h-3.5 w-3.5 rounded border-[#d3d3db]"
          />
          Track by serial number
        </label>
      )}

      {/* Scenario 55 (Stock-side Manual RR parity, follow-up) — mirrors
          ManualRrLineRow.tsx's own serial inputs: always visible once
          serial-tracked and quantity is set, never behind a column/button
          toggle. Keeps Stock's own richer capture components (duplicate
          highlighting, a progress readout, Clear all) rather than switching
          to Manual RR's bare text-input grid — that part was never what was
          being compared. Each component still takes an onClose (its own
          "Close" button stays in the header), now a no-op: there's no
          toggle state left for it to collapse into, and a serial-tracked
          line always needs its serials entered regardless. */}
      {isSerialTracked &&
        qty > 0 &&
        (showInstallmentAccountPicker ? (
          <div className="mt-2.5">
            <RepossessedSerialCaptureDrawer
              itemId={line.itemId ?? ''}
              quantity={qty}
              serialIds={line.existingSerialNumberIds ?? []}
              labels={existingSerialLabels ?? {}}
              showErrors={showErrors}
              isDuplicate={isDuplicateSerial}
              onChange={onExistingSerialChange}
              onClose={() => {}}
            />
          </div>
        ) : (
          <div className="mt-2.5">
            <SerialCaptureDrawer
              quantity={qty}
              serials={line.serialNumbers ?? []}
              showErrors={showErrors}
              isDuplicate={isDuplicateSerial}
              onChange={onSerialChange}
              onClearAll={onClearSerials}
              onClose={() => {}}
            />
          </div>
        ))}

      {issues.map((issue, n) => (
        <div
          key={n}
          className={`mt-2 flex items-center gap-2 text-[11.5px] ${
            issue.kind === 'error' ? 'text-[#b42318]' : 'text-[#8a4b06]'
          }`}
        >
          <span
            className={`inline-block h-[5px] w-[5px] shrink-0 rounded-full ${
              issue.kind === 'error' ? 'bg-[#b42318]' : 'bg-[#b25e09]'
            }`}
          />
          <span className="min-w-0 flex-1">{issue.text}</span>
          {issue.fix && (
            <button
              type="button"
              onClick={() => onFixIssue(issue.fix as IssueFix)}
              className="shrink-0 text-[11.5px] text-[#5b21b6] underline hover:text-[#4a189b]"
            >
              {issue.fix === 'serials' ? 'Enter serials' : 'Fix'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function FieldError({ text }: { text?: string }): React.ReactElement {
  return (
    <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[#b42318]">
      <span className="inline-block h-[5px] w-[5px] shrink-0 rounded-full bg-[#b42318]" />
      {text}
    </span>
  )
}
