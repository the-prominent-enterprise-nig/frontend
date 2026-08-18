'use client'

import { useEffect } from 'react'
import {
  useForm,
  useWatch,
  useController,
  Controller,
  useFieldArray,
  type Control,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  CreateTransferFormSchema,
  CreateTransferFormValues,
} from '@/src/schema/inventory/transfers'
import type { WarehouseSummary } from '@/src/schema/inventory/warehouses'
import type { ApiResponse } from '@/src/libs/api/client'
import { getItem } from '../../items/_actions/get-item'
import { ItemSearchCombobox } from '../../purchase-requests/_components/ItemSearchCombobox'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateTransferFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouses: WarehouseSummary[]
  // A Branch Manager is always requesting stock be sent TO their own branch
  // — "To Branch" locks to it, "From Branch" stays their free choice of who
  // to ask. null/undefined (head office / Business Owner) leaves both fully
  // open, matching this project's role-hierarchy convention.
  currentUserBranchId?: string | null
}

// Each branch has exactly one warehouse, so this picker is really choosing a
// branch — display the branch's own name rather than the warehouse's
// auto-generated "{branch} Warehouse" name.
function branchLabel(wh: WarehouseSummary): string {
  return wh.branch?.name ?? wh.name
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

type LineRowProps = {
  control: Control<CreateTransferFormValues>
  index: number
  canRemove: boolean
  onRemove: () => void
  itemError?: string
  quantityError?: string
}

function TransferLineRow({
  control,
  index,
  canRemove,
  onRemove,
  itemError,
  quantityError,
}: LineRowProps) {
  const selectedItemId = useWatch({ control, name: `lines.${index}.itemId` })

  // ItemSearchCombobox searches the catalog server-side rather than from a
  // fixed pre-fetched list, so the selected item's own isSerialTracked flag
  // is looked up directly by id rather than assumed present in some list.
  const itemDetailQuery = useQuery({
    queryKey: ['inventory-item-detail', selectedItemId],
    queryFn: () => getItem(selectedItemId),
    enabled: !!selectedItemId,
    staleTime: 5 * 60 * 1000,
  })
  const isSerialTracked = itemDetailQuery.data?.data?.isSerialTracked ?? false

  // The requester never picks a specific serial — they can't know what's
  // physically on the shelf at the other branch/warehouse. The specific unit
  // is chosen later by whoever's dispatching (see TransferDetailModal's
  // dispatch form). All this side needs is "1 unit" per line, matching the
  // backend's own per-line invariant for a serial-tracked line.
  const quantityController = useController({ control, name: `lines.${index}.quantity` })
  useEffect(() => {
    if (isSerialTracked && quantityController.field.value !== 1) {
      quantityController.field.onChange(1)
    }
    // Only re-run when the tracked-ness flips — not on every quantity edit,
    // which would fight a non-serial-tracked line's own quantity input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSerialTracked])

  return (
    <div className="rounded-lg border border-zinc-100 p-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Controller
            name={`lines.${index}.itemId`}
            control={control}
            render={({ field: f }) => (
              <ItemSearchCombobox value={f.value} onChange={f.onChange} error={itemError} />
            )}
          />
          {itemError && <p className="mt-1 text-xs text-red-600">{itemError}</p>}
        </div>

        <div className="w-28 shrink-0">
          {isSerialTracked ? (
            <input
              value={1}
              disabled
              readOnly
              className={`${fieldClass} bg-zinc-50 text-zinc-500`}
            />
          ) : (
            <input
              value={quantityController.field.value}
              name={quantityController.field.name}
              onBlur={quantityController.field.onBlur}
              ref={quantityController.field.ref}
              type="number"
              min="1"
              step="1"
              placeholder="Qty"
              className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
              onChange={(e) =>
                quantityController.field.onChange(
                  e.target.value === '' ? '' : Number(e.target.value)
                )
              }
            />
          )}
          {quantityError && <p className="mt-1 text-xs text-red-600">{quantityError}</p>}
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="mt-0.5 rounded p-2 text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {isSerialTracked && (
        <p className="mt-2 pl-0.5 text-xs text-zinc-400">
          Serial-tracked — 1 unit per line. The source branch/warehouse picks the specific serial
          when they dispatch it.
        </p>
      )}
    </div>
  )
}

export default function CreateTransferModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  warehouses,
  currentUserBranchId,
}: Props) {
  const today = new Date().toISOString().split('T')[0]

  const ownBranchWarehouses = currentUserBranchId
    ? warehouses.filter((wh) => wh.branchId === currentUserBranchId)
    : []
  // Only lock the field when it resolves to exactly one warehouse — if a
  // branch ever has more than one, a Branch Manager still needs to choose
  // among their own rather than have an arbitrary one silently picked.
  const lockedToWarehouseId =
    ownBranchWarehouses.length === 1 ? ownBranchWarehouses[0].id : undefined

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTransferFormValues>({
    resolver: zodResolver(CreateTransferFormSchema),
    defaultValues: {
      fromWarehouseId: '',
      toWarehouseId: '',
      transferDate: today,
      expectedArrival: '',
      reason: '',
      lines: [{ itemId: '', quantity: 1 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const fromId = watch('fromWarehouseId')
  const transferDate = watch('transferDate')
  const expectedArrival = watch('expectedArrival')
  // Live check (not gated behind a submit attempt) so the error and disabled
  // Save button appear the instant an invalid date is picked, not only after
  // the user tries to submit once.
  const arrivalBeforeTransfer =
    !!expectedArrival && !!transferDate && expectedArrival < transferDate

  useEffect(() => {
    if (isOpen) {
      // Re-applied on every open (not just mount) since `warehouses` loads
      // asynchronously and may not have resolved the lock yet at mount time.
      reset({
        fromWarehouseId: '',
        toWarehouseId: lockedToWarehouseId ?? '',
        transferDate: today,
        expectedArrival: '',
        reason: '',
        lines: [{ itemId: '', quantity: 1 }],
      })
    } else {
      reset({
        fromWarehouseId: '',
        toWarehouseId: '',
        transferDate: today,
        expectedArrival: '',
        reason: '',
        lines: [{ itemId: '', quantity: 1 }],
      })
    }
    // lockedToWarehouseId intentionally omitted — this must only reset on
    // the open/close transition, not on every render while the modal stays
    // open (which would wipe in-progress edits if `warehouses` re-fetches).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, reset, today])

  // `warehouses` (and therefore lockedToWarehouseId) resolves asynchronously
  // and can still be empty at the moment the effect above runs on open, so
  // the locked value wouldn't otherwise reach the form state until the next
  // open/close cycle. This narrowly re-syncs just that one field — safe to
  // depend on lockedToWarehouseId directly since a locked field is never
  // something the user is actively editing.
  useEffect(() => {
    if (isOpen && lockedToWarehouseId) {
      setValue('toWarehouseId', lockedToWarehouseId, { shouldValidate: true })
    }
  }, [isOpen, lockedToWarehouseId, setValue])

  if (!isOpen) return null

  async function handleFormSubmit(data: CreateTransferFormValues) {
    const result = await onSubmit({
      ...data,
      // Fields are defaulted to '' (not undefined) so their inputs stay
      // controlled from mount — but the backend DTO's @IsOptional() only
      // skips validation for undefined, not '', so an empty expectedArrival
      // would fail @IsDateString(). Normalize back to undefined here.
      expectedArrival: data.expectedArrival || undefined,
      reason: data.reason || undefined,
    })
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">New Stock Transfer Request</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Submitted as a request — routed to the source branch, or to head office first if
              approval is required.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <div className="space-y-5 px-6 py-5">
            {/* From / To — a warehouse or a branch, either can appear here */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  From <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="fromWarehouseId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="">Select source…</option>
                      {warehouses
                        .filter((wh) => wh.id !== lockedToWarehouseId)
                        .map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {branchLabel(wh)}
                          </option>
                        ))}
                    </select>
                  )}
                />
                {errors.fromWarehouseId && (
                  <p className="mt-1 text-xs text-red-600">{errors.fromWarehouseId.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  To <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="toWarehouseId"
                  control={control}
                  render={({ field }) =>
                    lockedToWarehouseId ? (
                      <select
                        {...field}
                        disabled
                        className={`${fieldClass} bg-zinc-50 text-zinc-500`}
                      >
                        <option value={lockedToWarehouseId}>
                          {branchLabel(ownBranchWarehouses[0])}
                        </option>
                      </select>
                    ) : (
                      <select {...field} className={`${fieldClass} bg-white`}>
                        <option value="">Select destination…</option>
                        {(currentUserBranchId ? ownBranchWarehouses : warehouses)
                          .filter((wh) => wh.id !== fromId)
                          .map((wh) => (
                            <option key={wh.id} value={wh.id}>
                              {branchLabel(wh)}
                            </option>
                          ))}
                      </select>
                    )
                  }
                />
                {lockedToWarehouseId && (
                  <p className="mt-1 text-xs text-zinc-400">
                    Requests are always routed to your own branch.
                  </p>
                )}
                {errors.toWarehouseId && (
                  <p className="mt-1 text-xs text-red-600">{errors.toWarehouseId.message}</p>
                )}
              </div>
            </div>

            {/* Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Transfer Date <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="transferDate"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
                {errors.transferDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.transferDate.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Expected Arrival
                </label>
                <Controller
                  name="expectedArrival"
                  control={control}
                  render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                />
                {(arrivalBeforeTransfer || errors.expectedArrival) && (
                  <p className="mt-1 text-xs text-red-600">
                    {errors.expectedArrival?.message ??
                      'Expected arrival cannot be before the transfer date'}
                  </p>
                )}
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Reason</label>
              <Controller
                name="reason"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. Rebalancing stock for upcoming campaign"
                    className={fieldClass}
                  />
                )}
              />
            </div>

            {/* Line Items */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700">
                  Items <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => append({ itemId: '', quantity: 1 })}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </button>
              </div>

              {errors.lines?.root && (
                <p className="mb-2 text-xs text-red-600">{errors.lines.root.message}</p>
              )}
              {typeof errors.lines?.message === 'string' && (
                <p className="mb-2 text-xs text-red-600">{errors.lines.message}</p>
              )}

              <div className="space-y-2">
                {fields.map((field, index) => (
                  <TransferLineRow
                    key={field.id}
                    control={control}
                    index={index}
                    canRemove={fields.length > 1}
                    onRemove={() => fields.length > 1 && remove(index)}
                    itemError={errors.lines?.[index]?.itemId?.message}
                    quantityError={errors.lines?.[index]?.quantity?.message}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || arrivalBeforeTransfer}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
