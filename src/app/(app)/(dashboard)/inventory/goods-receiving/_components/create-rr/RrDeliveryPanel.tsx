'use client'

import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import { Link2, Link2Off, Search } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import SearchableSelect, { type SearchableSelectOption } from '@/src/components/ui/SearchableSelect'
import { locationLabel } from '@/src/libs/format/locationLabel'
import { SupplierSearchCombobox } from '@/src/components/inventory/SupplierSearchCombobox'
import type { ReceiveStockFormValues } from '@/src/schema/inventory/goods-receiving'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import { CONTROL_CHROME, MONO } from '../../../purchase-orders/_components/procurementTokens'
import { INPUT, INPUT_BAD, PANEL } from './rrTokens'
import type { RrTotals } from './rrTotals'

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

const APPLICATION_TYPES: SearchableSelectOption[] = [
  { value: 'new_stock', label: 'New Stock' },
  { value: 'revert', label: 'Revert' },
]

const WITHHOLDING_OPTIONS: SearchableSelectOption[] = [
  { value: 'none', label: 'None' },
  { value: 'pct_1', label: '1% (BIR 2307)' },
]

const VAT_TREATMENTS: SearchableSelectOption[] = [
  { value: 'inclusive', label: 'VAT inclusive' },
  { value: 'exclusive', label: 'VAT exclusive' },
  { value: 'exempt', label: 'Exempt / zero-rated' },
]

type Props = {
  control: Control<ReceiveStockFormValues>
  errors: FieldErrors<ReceiveStockFormValues>
  warehouses: WarehouseOption[]
  canViewCost: boolean
  /** Validation messages are held back until the receiver has tried to post,
   * so an untouched form isn't red on open. */
  showErrors: boolean
  supplierId: string
  supplierName?: string
  linkedPo: PurchaseOrderSummary | null
  totals: RrTotals
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
  canViewCost,
  showErrors,
  supplierId,
  supplierName,
  linkedPo,
  totals,
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

      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 px-4.5 pb-4 pt-3.5 sm:grid-cols-2 xl:grid-cols-3">
        <Field label="Supplier" required>
          <div>
            <SupplierSearchCombobox
              value={supplierId}
              onChange={(id) => onSupplierChange(id)}
              onSelect={(option) => onSupplierChange(option.id, option.primary)}
              initialLabel={supplierName}
              error={showErrors && !supplierId && !linkedPo ? 'Supplier is required' : undefined}
            />
          </div>
          <Hint>
            {linkedPo ? `From ${linkedPo.code}` : 'Required unless this receipt is linked to a PO.'}
          </Hint>
        </Field>

        <Field label="Destination Location" required>
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
          {showErrors && errors.warehouseId ? (
            <FieldError text={errors.warehouseId.message} />
          ) : (
            <></>
          )}
        </Field>

        <Field label="Date Received">
          <Controller
            name="receivedAt"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ''}
                type="datetime-local"
                className={`${INPUT} text-[#3d3d4a]`}
              />
            )}
          />
          <Hint>Leave blank to stamp it as posted.</Hint>
        </Field>

        <Field label="Delivery Receipt No." required>
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
          {showErrors && errors.deliveryReceiptNumber ? (
            <FieldError text={errors.deliveryReceiptNumber.message} />
          ) : (
            <Hint>The supplier&rsquo;s own DR, as it came with the goods.</Hint>
          )}
        </Field>

        <Field label="Supplier Invoice No." hint="optional">
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
          <Hint>Fill it in later if the invoice follows on.</Hint>
        </Field>

        {/* The Receiving Report's "Driver/Helper" line — who physically
            brought the delivery. Free text on purpose: the Vehicle roster is
            our own fleet, for branch-to-branch transfers, and a supplier's
            crew will never be on it. A delivery often arrives with a driver
            and no helper, so neither is required. */}
        <Field label="Driver" hint="optional">
          <Controller
            name="driverName"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ''}
                type="text"
                placeholder="Name of whoever drove it in"
                className={INPUT}
              />
            )}
          />
          <Hint>Prints on the report&rsquo;s Driver/Helper line.</Hint>
        </Field>

        <Field label="Helper" hint="optional">
          <Controller
            name="helperName"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ''}
                type="text"
                placeholder="Name of the helper, if any"
                className={INPUT}
              />
            )}
          />
          <Hint>Leave blank if the driver came alone.</Hint>
        </Field>

        <Field label="PO Number" hint="optional">
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
                  className="flex h-[38px] items-center gap-1.5 rounded-lg border border-[#d3d3db] bg-white px-3 text-[12.5px] text-[#5b5b6b] hover:border-[#a3a3b2] hover:text-[#17171c]"
                >
                  <Link2Off className="h-3.5 w-3.5" />
                  Unlink
                </button>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={onBrowsePo}
                className="flex h-[38px] items-center gap-1.5 rounded-lg border border-[#ddd0f7] bg-[#f1ebfb] px-3 text-[12.5px] font-medium text-[#3f1490] hover:bg-[#e8ddfa]"
              >
                <Search className="h-3.5 w-3.5" />
                Browse
              </button>
            )}
          </div>
          <Hint>
            {linkedPo
              ? 'Posting moves the received quantities on this PO.'
              : 'Type a reference, or browse the open orders to link one.'}
          </Hint>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 border-t border-[#eeeef1] bg-[#fbfbfc] px-4.5 py-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Application Type" required>
          <Controller
            name="applicationType"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                value={field.value ?? 'new_stock'}
                onChange={field.onChange}
                chrome={CONTROL_CHROME}
                options={APPLICATION_TYPES}
              />
            )}
          />
        </Field>

        <Field label="Purchase Order Date">
          <Controller
            name="purchaseOrderDate"
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

        <Field label="Reference Number">
          <Controller
            name="code"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ''}
                type="text"
                placeholder="Auto-generated if blank"
                className={`${INPUT} ${MONO} text-[12.5px]`}
              />
            )}
          />
          <Hint>Leave blank for RR-YYYYMMDD-NNNN.</Hint>
        </Field>

        <Field label="Withholding">
          <Controller
            name="withholding"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                value={field.value ?? 'none'}
                onChange={(value) => field.onChange(value as 'none' | 'pct_1')}
                chrome={CONTROL_CHROME}
                options={WITHHOLDING_OPTIONS}
              />
            )}
          />
        </Field>

        {canViewCost && (
          <Field label="Withheld Amount">
            <Controller
              name="withheldAmount"
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
                  placeholder={totals.withheld.toFixed(2)}
                  className={`${INPUT} text-right ${MONO} text-[12.5px]`}
                />
              )}
            />
            <Hint>
              {totals.withheldIsDerived
                ? 'Computed from the lines. Type to override.'
                : 'Overridden from the supplier’s paperwork.'}
            </Hint>
          </Field>
        )}

        {canViewCost && (
          <Field label="VAT Treatment">
            <Controller
              name="vatTreatment"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value ?? 'inclusive'}
                  onChange={(value) =>
                    field.onChange(value as 'inclusive' | 'exclusive' | 'exempt')
                  }
                  chrome={CONTROL_CHROME}
                  options={VAT_TREATMENTS}
                />
              )}
            />
            <Hint>How the unit costs entered relate to VAT.</Hint>
          </Field>
        )}

        {/* `nndpCost` on the wire, and the acronym is what the client's own
            paperwork calls it — but nobody arriving at this form cold reads it
            as a cost, so the field says what it holds and keeps the acronym in
            the hint. */}
        {canViewCost && (
          <Field label="Net Delivered Cost">
            <Controller
              name="nndpCost"
              control={control}
              render={({ field }) => (
                <input
                  value={field.value ?? ''}
                  onChange={(e) =>
                    field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)
                  }
                  onBlur={field.onBlur}
                  onFocus={(e) => e.target.select()}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={`${INPUT} text-right ${MONO} text-[12.5px]`}
                />
              )}
            />
            {errors.nndpCost ? (
              <FieldError text={errors.nndpCost.message} />
            ) : (
              <Hint>NNDP: the delivery&rsquo;s cost, net of discounts.</Hint>
            )}
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
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12px] font-medium text-[#3d3d4a]">
        {label}
        {required && <span className="text-[#b42318]"> *</span>}
        {hint && <span className="ml-1 font-normal text-[#8b8b9b]">{hint}</span>}
      </span>
      {children}
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
