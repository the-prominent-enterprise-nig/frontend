'use client'

import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import { Info, Link2, Link2Off, Search } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import SearchableSelect, { type SearchableSelectOption } from '@/src/components/ui/SearchableSelect'
import { locationLabel } from '@/src/libs/format/locationLabel'
import { SupplierSearchCombobox } from '@/src/components/inventory/SupplierSearchCombobox'
import type { ReceiveStockFormValues } from '@/src/schema/inventory/goods-receiving'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import { CONTROL_CHROME, MONO } from '../../../purchase-orders/_components/procurementTokens'
import { INPUT, INPUT_BAD, PANEL } from './rrTokens'

export type WarehouseOption = {
  id: string
  name: string
  code: string
  /** Set on a branch's own stock location, null on a standalone warehouse.
   * Decides which group the option lands in below. */
  branchId?: string | null
  branch?: { id: string; name: string } | null
}

/** The shared control chrome, in the "this field is why you can't post" state.
 * SearchableSelect takes its border treatment as a prop rather than a class,
 * so the invalid case has to be expressed the same way. */
const INVALID_CHROME = { idle: 'border-[#b42318]', focused: 'border-[#b42318]' }

// Scenario 55 (Stock-side Manual RR parity) — same toggle chrome as
// ManualRrForm.tsx's own Source/Catalog-item toggles, copied rather than
// shared since the two live in separate route trees with their own token
// modules.
const toggleBtnClass = (active: boolean) =>
  `shrink-0 rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors ${
    active
      ? 'border-[#ddd0f7] bg-[#f1ebfb] text-[#3f1490]'
      : 'border-[#d3d3db] text-[#5b5b6b] hover:border-[#a3a3b2]'
  }`

// Scenario 55 — why this is a no-PO receipt with no registered supplier.
// '' reads as "None" — an ordinary supplier/PO-linked delivery, the
// existing default this form has always had.
const REASON_OPTIONS: SearchableSelectOption[] = [
  { value: '', label: 'None — ordinary supplier delivery' },
  { value: 'repair_return', label: 'Repair return' },
  { value: 'repossession', label: 'Repossession' },
  { value: 'other', label: 'Other' },
]

type Props = {
  control: Control<ReceiveStockFormValues>
  errors: FieldErrors<ReceiveStockFormValues>
  warehouses: WarehouseOption[]
  /** Validation messages are held back until the receiver has tried to post,
   * so an untouched form isn't red on open. */
  showErrors: boolean
  supplierId: string
  supplierName?: string
  linkedPo: PurchaseOrderSummary | null
  /** Scenario 55 — the currently-picked reason, read here only to soften the
   * Source field's "required" treatment; the field itself lives on
   * `control` like everything else on this panel. */
  reason?: string
  /** Scenario 55 (Stock-side Manual RR parity) — mirrors ManualRrForm.tsx's
   * own sourceMode: which of supplierId / newSourceName is live. Lifted to
   * the parent (like supplierId itself) so post() there can decide which one
   * to actually submit. */
  sourceMode: 'registered' | 'new'
  onSourceModeChange: (mode: 'registered' | 'new') => void
  onSupplierChange: (id: string, name?: string) => void
  onBrowsePo: () => void
  onUnlinkPo: () => void
}

/** The supplier's own paperwork, where the goods landed, and how the invoice
 * behind them is taxed. */
export function RrDeliveryPanel({
  control,
  errors,
  warehouses,
  showErrors,
  supplierId,
  supplierName,
  linkedPo,
  reason,
  sourceMode,
  onSourceModeChange,
  onSupplierChange,
  onBrowsePo,
  onUnlinkPo,
}: Props): React.ReactElement {
  // The warehouses lead and the branches follow, each branch marked as such:
  // SearchableSelect is a flat type-ahead with no group headings, and a plain
  // alphabetical mix of 2 warehouses and 41 branch locations is exactly how a
  // receiver picks the wrong kind of destination.
  const isBranchLocation = (warehouse: WarehouseOption): boolean =>
    !!warehouse.branchId || !!warehouse.branch
  const locationOptions: SearchableSelectOption[] = [
    ...warehouses
      .filter((warehouse) => !isBranchLocation(warehouse))
      .map((warehouse) => ({
        value: warehouse.id,
        label: locationLabel(warehouse, warehouse.name),
      })),
    ...warehouses.filter(isBranchLocation).map((warehouse) => ({
      value: warehouse.id,
      label: `${locationLabel(warehouse, warehouse.name)}`,
    })),
  ]

  return (
    <div className={`${PANEL} flex flex-col overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-4.5 py-2.5">
        <span className="text-[13.5px] font-semibold">Delivery details</span>
        {linkedPo ? (
          <span className="flex items-center gap-2 rounded-[5px] bg-[#f1ebfb] px-2 py-0.5 text-[11.5px] font-medium text-[#3f1490]">
            <Link2 className="h-3 w-3" />
            Linked to {linkedPo.code}
          </span>
        ) : (
          <span className="text-[11.5px] text-[#8b8b9b]">
            Direct delivery, no purchase order linked
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-x-4 gap-y-3.5 px-4.5 pb-4 pt-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {/* Its own row, nothing beside it — Reason changes what several other
            fields on this panel mean (Source becomes optional, PO/Supplier
            Invoice disappear), so it reads as the one decision that comes
            before the rest rather than competing for space with them. */}
        {!linkedPo && (
          <div className="sm:col-span-2 xl:col-span-3">
            <Field
              label="Reason"
              hint="optional"
              footer={
                <Hint>
                  Getting your own stock back — a repair return, a repossession — rather than a
                  purchase. Drops the supplier requirement below.
                </Hint>
              }
            >
              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    chrome={CONTROL_CHROME}
                    options={REASON_OPTIONS}
                  />
                )}
              />
            </Field>
          </div>
        )}

        {/* Scenario 55 (Stock-side Manual RR parity) — always visible now,
            mirroring ManualRrForm.tsx's own "Source" field exactly: a
            Registered/Other toggle rather than a single Supplier combobox,
            so a delivery from an unregistered source can be named instead of
            forced through the catalog. Optional once a reason is picked or a
            PO is linked — getting your own stock back, or fulfilling a PO
            that already names its supplier, genuinely has no separate source
            to require. */}
        <Field
          label="Source"
          required={!linkedPo && !reason}
          tooltip={
            linkedPo
              ? `From ${linkedPo.code}`
              : reason
                ? 'Optional — name it if known.'
                : 'Required unless this receipt is linked to a PO.'
          }
        >
          {!linkedPo && (
            <div className="mb-1 flex gap-1.5">
              <button
                type="button"
                className={toggleBtnClass(sourceMode === 'registered')}
                onClick={() => onSourceModeChange('registered')}
              >
                Registered
              </button>
              <button
                type="button"
                className={toggleBtnClass(sourceMode === 'new')}
                onClick={() => onSourceModeChange('new')}
              >
                Other
              </button>
            </div>
          )}
          {linkedPo || sourceMode === 'registered' ? (
            <SupplierSearchCombobox
              value={supplierId}
              onChange={(id) => onSupplierChange(id)}
              onSelect={(option) => onSupplierChange(option.id, option.primary)}
              initialLabel={supplierName}
              error={
                showErrors && !linkedPo && !reason && !supplierId ? 'Source is required' : undefined
              }
            />
          ) : (
            <Controller
              name="newSourceName"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  value={field.value ?? ''}
                  type="text"
                  placeholder="Who or what this came from"
                  className={INPUT}
                />
              )}
            />
          )}
        </Field>

        <Field
          label="Location"
          required
          footer={
            showErrors && errors.warehouseId ? (
              <FieldError text={errors.warehouseId.message} />
            ) : undefined
          }
        >
          <Controller
            name="warehouseId"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                value={field.value ?? ''}
                onChange={field.onChange}
                placeholder="Select location…"
                loading={warehouses.length === 0}
                loadingLabel="Loading locations…"
                chrome={showErrors && errors.warehouseId ? INVALID_CHROME : CONTROL_CHROME}
                options={locationOptions}
              />
            )}
          />
        </Field>

        {/* Scenario 55 (Stock-side Manual RR parity, follow-up) — date only,
            matching ManualRrForm.tsx's own Date Received field exactly; the
            time-of-day this form previously also collected was never
            something Manual RR asked for. */}
        <Field label="Date Received" tooltip="Leave blank to stamp it as posted.">
          <Controller
            name="receivedAt"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ''}
                type="date"
                className={`${INPUT} text-[#3d3d4a]`}
              />
            )}
          />
        </Field>

        <Field
          label="Delivery Receipt No."
          hint="optional"
          footer={
            showErrors && errors.deliveryReceiptNumber ? (
              <FieldError text={errors.deliveryReceiptNumber.message} />
            ) : (
              <Hint>The supplier&rsquo;s own DR, as it came with the goods.</Hint>
            )
          }
        >
          <Controller
            name="deliveryReceiptNumber"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ''}
                type="text"
                placeholder="e.g. DR-00123"
                className={showErrors && errors.deliveryReceiptNumber ? INPUT_BAD : INPUT}
              />
            )}
          />
        </Field>

        {/* No supplier, no invoice — same reasoning as PO Number/Date and
            the whole Withholding/VAT/NNDP row below. */}
        {!reason && (
          <Field
            label="Supplier Invoice No."
            hint="optional"
            footer={<Hint>Fill it in later if the invoice follows on.</Hint>}
          >
            <Controller
              name="supplierInvoiceNumber"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  value={field.value ?? ''}
                  type="text"
                  placeholder="e.g. SI-00456"
                  className={INPUT}
                />
              )}
            />
          </Field>
        )}

        {/* Mutually exclusive with Reason above, same as the panel's own
            supplier-vs-reason split — a reasoned receipt isn't fulfilling a
            PO. */}
        {!reason && (
          <Field
            label="PO Number"
            hint="optional"
            footer={
              <Hint>
                {linkedPo
                  ? 'Posting moves the received quantities on this PO.'
                  : 'Type a reference, or browse the open orders to link one.'}
              </Hint>
            }
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <Controller
                name="purchaseOrderNumber"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    value={field.value ?? ''}
                    readOnly={!!linkedPo}
                    type="text"
                    placeholder="e.g. PO-20260910-0001"
                    aria-label="PO number"
                    className={`${INPUT} ${MONO} text-[12.5px] ${
                      linkedPo ? 'border-[#ddd0f7] bg-[#faf7ff] font-medium' : ''
                    }`}
                  />
                )}
              />
              {linkedPo ? (
                <Tooltip label="Unlink this purchase order" side="bottom" align="end">
                  <button
                    type="button"
                    onClick={onUnlinkPo}
                    className="flex h-9.5 items-center gap-1.5 rounded-lg border border-[#d3d3db] bg-white px-3 text-[12.5px] text-[#5b5b6b] hover:border-[#a3a3b2] hover:text-[#17171c]"
                  >
                    <Link2Off className="h-3.5 w-3.5" />
                    Unlink
                  </button>
                </Tooltip>
              ) : (
                <button
                  type="button"
                  onClick={onBrowsePo}
                  className="flex h-9.5 items-center gap-1.5 rounded-lg border border-[#ddd0f7] bg-[#f1ebfb] px-3 text-[12.5px] font-medium text-[#3f1490] hover:bg-[#e8ddfa]"
                >
                  <Search className="h-3.5 w-3.5" />
                  Browse
                </button>
              )}
            </div>
          </Field>
        )}
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  tooltip,
  footer,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  /** Explanatory text that would otherwise sit as a line below the control —
   * an info icon + hover tooltip instead, so it never affects this field's
   * height (and so never disagrees with a sibling field whose own control
   * needs to line up with this one across the row). Mirrors
   * ManualRrForm.tsx's own Field component exactly — this is specifically
   * why Manual RR's own Source/Location/Date Received row lines up and an
   * earlier version of this one, which used a permanent Hint here instead,
   * didn't: every field in that row has to carry the SAME (zero) footer
   * weight under normal conditions for stretch+justify-end to land them on
   * the same line — a footer that's sometimes a real hint and sometimes
   * nothing breaks that, no matter how the empty case is padded. */
  tooltip?: string
  /** Rare, transient content below the control (e.g. a validation
   * FieldError) — normally absent, same as Manual RR's own footer prop. */
  footer?: React.ReactNode
  children: React.ReactNode
}): React.ReactElement {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 self-stretch">
      <span className="flex items-center gap-1 text-[12px] font-medium text-[#3d3d4a]">
        {label}
        {required && <span className="text-[#b42318]"> *</span>}
        {hint && <span className="ml-1 font-normal text-[#8b8b9b]">{hint}</span>}
        {tooltip && (
          <Tooltip label={tooltip}>
            <Info className="h-3 w-3 text-[#a3a3b2]" />
          </Tooltip>
        )}
      </span>
      {/* flex-1 + justify-end: when a sibling field (Source, which has a
       * toggle row above its own control) stretches this row taller than
       * this field's own content needs, the control still bottom-aligns
       * with everyone else's instead of floating at the top of the extra
       * space. */}
      <div className="flex flex-1 flex-col justify-end gap-1.5">{children}</div>
      {footer}
    </label>
  )
}

function Hint({ children }: { children: React.ReactNode }): React.ReactElement {
  return <span className="text-[11px] leading-[1.4] text-[#8b8b9b]">{children}</span>
}

function FieldError({ text }: { text?: string }): React.ReactElement {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-[#b42318]">
      <span className="inline-block h-[5px] w-[5px] rounded-full bg-[#b42318]" />
      {text}
    </span>
  )
}
