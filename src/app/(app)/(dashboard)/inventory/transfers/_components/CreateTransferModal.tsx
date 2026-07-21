'use client'

import { useEffect, useState } from 'react'
import { useForm, useWatch, Controller, useFieldArray, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { X, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  CreateTransferFormSchema,
  CreateTransferFormValues,
} from '@/src/schema/inventory/transfers'
import type { WarehouseSummary } from '@/src/schema/inventory/warehouses'
import type { ApiResponse } from '@/src/libs/api/client'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'
import { getItem } from '../../items/_actions/get-item'
import { ItemSearchCombobox } from '../../purchase-requests/_components/ItemSearchCombobox'
import { SerialSearchCombobox } from './SerialSearchCombobox'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateTransferFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouses: WarehouseSummary[]
  // A Branch Manager is always requesting stock be sent TO their own branch
  // — "To Warehouse" locks to it, "From Warehouse" stays their free choice of
  // who to ask. null/undefined (head office / Business Owner) leaves both
  // fully open, matching this project's role-hierarchy convention.
  currentUserBranchId?: string | null
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

type LineRowProps = {
  control: Control<CreateTransferFormValues>
  index: number
  fromWarehouseId: string | undefined
  canRemove: boolean
  onRemove: () => void
  onSerialTrackedChange: (itemId: string, isSerialTracked: boolean) => void
  itemError?: string
  quantityError?: string
  serialError?: string
}

function TransferLineRow({
  control,
  index,
  fromWarehouseId,
  canRemove,
  onRemove,
  onSerialTrackedChange,
  itemError,
  quantityError,
  serialError,
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

  useEffect(() => {
    if (selectedItemId) onSerialTrackedChange(selectedItemId, isSerialTracked)
  }, [selectedItemId, isSerialTracked, onSerialTrackedChange])

  // Scoped to this line's specific item + the chosen source warehouse (not a
  // blanket tenant-wide fetch) — with thousands of in-stock serials across a
  // real tenant, an unscoped fetch capped at a fixed limit can silently miss
  // the very serials that matter here.
  const serialsQuery = useQuery({
    queryKey: ['inventory-serials-in-stock', fromWarehouseId, selectedItemId],
    queryFn: () =>
      getSerialNumbers({
        warehouseId: fromWarehouseId,
        itemId: selectedItemId,
        status: 'in_stock',
        limit: 500,
      }),
    enabled: isSerialTracked && !!fromWarehouseId && !!selectedItemId,
    staleTime: 60 * 1000,
  })
  const serialOptions = serialsQuery.data?.data?.data ?? []
  const serialFieldDisabled = !fromWarehouseId || serialsQuery.isLoading

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
          <Controller
            name={`lines.${index}.quantity`}
            control={control}
            render={({ field: f }) => (
              <input
                {...f}
                type="number"
                min="1"
                step="1"
                placeholder="Qty"
                className={`${fieldClass} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                onChange={(e) => f.onChange(e.target.value === '' ? '' : Number(e.target.value))}
              />
            )}
          />
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
        <div className="mt-2 pl-0.5">
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Specific serial number <span className="text-red-500">*</span>
          </label>
          <Controller
            name={`lines.${index}.serialNumberId`}
            control={control}
            render={({ field: f }) => (
              <SerialSearchCombobox
                value={f.value ?? ''}
                onChange={f.onChange}
                options={serialOptions}
                queryKey={`serial-search-${fromWarehouseId}-${selectedItemId}`}
                disabled={serialFieldDisabled}
                placeholder={
                  !fromWarehouseId
                    ? 'Please select a warehouse first'
                    : serialsQuery.isLoading
                      ? 'Loading serials…'
                      : 'Search serial number…'
                }
                error={serialError}
              />
            )}
          />
          {serialError && <p className="mt-1 text-xs text-red-600">{serialError}</p>}
        </div>
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
    setError,
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
      lines: [{ itemId: '', quantity: 1, serialNumberId: '' }],
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

  // Keyed by itemId (not line index) so a line removal — which shifts every
  // later index down — can never leave this map pointing at the wrong line.
  const [serialTrackedByItemId, setSerialTrackedByItemId] = useState<Record<string, boolean>>({})

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
        lines: [{ itemId: '', quantity: 1, serialNumberId: '' }],
      })
    } else {
      reset({
        fromWarehouseId: '',
        toWarehouseId: '',
        transferDate: today,
        expectedArrival: '',
        reason: '',
        lines: [{ itemId: '', quantity: 1, serialNumberId: '' }],
      })
      setSerialTrackedByItemId({})
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
    let missingRequiredSerial = false
    data.lines.forEach((line, idx) => {
      if (serialTrackedByItemId[line.itemId] && !line.serialNumberId) {
        setError(`lines.${idx}.serialNumberId`, {
          type: 'required',
          message: 'This field is required',
        })
        missingRequiredSerial = true
      }
    })
    if (missingRequiredSerial) return

    const result = await onSubmit({
      ...data,
      // Fields are defaulted to '' (not undefined) so their inputs stay
      // controlled from mount — but the backend DTO's @IsOptional() only
      // skips validation for undefined, not '', so an empty expectedArrival
      // would fail @IsDateString(). Normalize back to undefined here.
      expectedArrival: data.expectedArrival || undefined,
      reason: data.reason || undefined,
      lines: data.lines.map((line) => ({
        ...line,
        serialNumberId: line.serialNumberId || undefined,
      })),
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
            {/* Warehouses */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  From Warehouse <span className="text-red-500">*</span>
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
                            {wh.code} — {wh.name}
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
                  To Warehouse <span className="text-red-500">*</span>
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
                          {ownBranchWarehouses[0].code} — {ownBranchWarehouses[0].name}
                        </option>
                      </select>
                    ) : (
                      <select {...field} className={`${fieldClass} bg-white`}>
                        <option value="">Select destination…</option>
                        {(currentUserBranchId ? ownBranchWarehouses : warehouses)
                          .filter((wh) => wh.id !== fromId)
                          .map((wh) => (
                            <option key={wh.id} value={wh.id}>
                              {wh.code} — {wh.name}
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
                  onClick={() => append({ itemId: '', quantity: 1, serialNumberId: '' })}
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
                    fromWarehouseId={fromId}
                    canRemove={fields.length > 1}
                    onRemove={() => fields.length > 1 && remove(index)}
                    onSerialTrackedChange={(itemId, isTracked) =>
                      setSerialTrackedByItemId((prev) =>
                        prev[itemId] === isTracked ? prev : { ...prev, [itemId]: isTracked }
                      )
                    }
                    itemError={errors.lines?.[index]?.itemId?.message}
                    quantityError={errors.lines?.[index]?.quantity?.message}
                    serialError={errors.lines?.[index]?.serialNumberId?.message}
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
