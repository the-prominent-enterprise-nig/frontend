'use client'

import { Controller, type Control, type FieldErrors } from 'react-hook-form'
import { Lock } from 'lucide-react'
import { locationLabel } from '@/src/libs/format/locationLabel'
import Tooltip from '@/src/components/ui/Tooltip'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import { INPUT, INPUT_BAD, PANEL } from './receiveTokens'
import type { ReceivePoFormValues } from './receiveSchema'

type WarehouseOption = { id: string; name: string }

/** Shared with the checks card, which focuses this field when the receiver
 * presses Fix on the "delivery receipt number is required" blocker. */
export const DR_FIELD_ID = 'receive-po-delivery-receipt-number'

type Props = {
  control: Control<ReceivePoFormValues>
  errors: FieldErrors<ReceivePoFormValues>
  po: PurchaseOrderSummary
  warehouses: WarehouseOption[]
  /** Whether validation messages are live yet — they are held back until the
   * receiver has tried to move on, so an untouched form isn't red on open. */
  showErrors: boolean
  /** The DR as currently typed. The header badge is driven by the value
   * itself, not by whether validation has run — see below. */
  deliveryReceiptNumber: string
  recap: string
}

/** The supplier's own paperwork and where the goods landed. */
export function DeliveryDetailsPanel({
  control,
  errors,
  po,
  warehouses,
  showErrors,
  deliveryReceiptNumber,
  recap,
}: Props) {
  // Two different questions, and conflating them made the panel lie. Whether
  // a DR has been entered is a fact about the delivery and is true or false
  // from the moment the screen opens — so the badge reads it straight off the
  // value. Whether to paint the input red is a question about the receiver's
  // progress through the form, and stays held back until they have tried to
  // move on. Driving the badge off the error state meant an untouched screen
  // with an empty DR announced "Confirmed".
  const drEmpty = !deliveryReceiptNumber.trim()
  const drInvalid = showErrors && !!errors.deliveryReceiptNumber

  return (
    <div className={`${PANEL} flex h-full flex-col overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-4.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-[13.5px] font-semibold">Delivery details</span>
          <span
            className={`rounded-[5px] px-2 py-0.5 text-[11.5px] font-medium ${
              drEmpty ? 'bg-[#fdeceb] text-[#b42318]' : 'bg-[#e7f5ef] text-[#0b6644]'
            }`}
          >
            {drEmpty ? 'Needs DR number' : 'Confirmed'}
          </span>
        </div>
        <span className="min-w-0 truncate text-[11.5px] text-[#8b8b9b]">{recap}</span>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 px-4.5 pb-4 pt-3.5 sm:grid-cols-2">
        <Field label="Destination" required>
          {po.warehouseId ? (
            // Locked, not merely disabled: stock always lands where it was
            // ordered for, and the lock icon says why the box can't be typed in.
            <Tooltip label="Inherited from the purchase order" className="w-full" side="bottom">
              <div className="flex h-[38px] w-full items-center gap-2.5 rounded-lg border border-[#e4e4e9] bg-[#f7f7f8] px-3">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#3d3d4a]">
                  {locationLabel(po.warehouse)}
                </span>
                <Lock className="h-3.5 w-3.5 shrink-0 text-[#8b8b9b]" />
              </div>
            </Tooltip>
          ) : (
            // Fallback for a PO created before the destination warehouse became
            // required at PO-creation time — still restricted to the real
            // warehouses, just editable here instead of locked.
            <Controller
              name="warehouseId"
              control={control}
              render={({ field }) => (
                <select {...field} className={INPUT}>
                  <option value="">Select warehouse…</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name}
                    </option>
                  ))}
                </select>
              )}
            />
          )}
          {showErrors && errors.warehouseId && <FieldError text={errors.warehouseId.message} />}
        </Field>

        <Field label="Date received">
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
        </Field>

        <Field label="Delivery receipt no." required>
          <Controller
            name="deliveryReceiptNumber"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                // The checks card's "Fix" focuses this by id. A ref passed down
                // through the panel would be tidier, but the blocker list is
                // built from watched values in the orchestrator and has no
                // handle on the rendered field — and the id is stable because
                // only one receive screen is ever mounted at a time.
                id={DR_FIELD_ID}
                value={field.value ?? ''}
                type="text"
                placeholder="As printed on the delivery receipt"
                className={drInvalid ? INPUT_BAD : INPUT}
              />
            )}
          />
          {drInvalid && <FieldError text={errors.deliveryReceiptNumber?.message} />}
        </Field>

        <Field label="Supplier invoice no." hint="optional">
          <Controller
            name="supplierInvoiceNumber"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value ?? ''}
                type="text"
                placeholder="Leave blank if it follows later"
                className={INPUT}
              />
            )}
          />
        </Field>

        {/* The report's "Driver/Helper" line. Neither is required — a
            delivery often arrives with a driver and no helper. */}
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
                placeholder="Blank if the driver came alone"
                className={INPUT}
              />
            )}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Notes">
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  value={field.value ?? ''}
                  type="text"
                  placeholder="Pallet condition, seal numbers, anything the receiver should record…"
                  className={INPUT}
                />
              )}
            />
          </Field>
        </div>
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
}) {
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

function FieldError({ text }: { text?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-[#b42318]">
      <span className="inline-block h-[5px] w-[5px] rounded-full bg-[#b42318]" />
      {text}
    </span>
  )
}
