'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { X, Loader2, Plus, Trash2, Package } from 'lucide-react'
import {
  CreateWarehouseRequestFormSchema,
  CreateWarehouseRequestFormValues,
} from '@/src/schema/inventory/warehouse-requests'
import type { WarehouseSummary } from '@/src/schema/inventory/warehouses'
import type { BranchLookup } from '../_actions/get-branches'
import type { ApiResponse } from '@/src/libs/api/client'
import { getItem } from '../../items/_actions/get-item'
import { ItemSearchCombobox } from '../../purchase-requests/_components/ItemSearchCombobox'
import { SerialMultiPicker } from './SerialMultiPicker'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateWarehouseRequestFormValues) => Promise<ApiResponse<unknown>>
  isSubmitting: boolean
  warehouseOptions: WarehouseSummary[]
  branchOptions: BranchLookup[]
  // null/undefined = Head Office / Business Owner — the branch picker below
  // starts blank instead of pre-filled. Whether this ends up a self-serve
  // pull (needs a real warehouse-side accept) or a self-approved delivery is
  // no longer picked here — the server derives it from who's creating this
  // and which branch it's for.
  currentUserBranchId?: string | null
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

// The form itself only stores itemId/serialNumberId (raw ids) — these two
// side-maps are what let the already-added list render real names and
// serial numbers instead. itemLabels is keyed by itemId (every line for the
// same item shares one name/sku, no need to repeat it per line);
// serialLabels is keyed by serialNumberId, captured at the moment a serial
// is picked since the form data itself never carries the human-readable
// string, only its id.
type ItemLabel = { name: string; sku?: string }

export default function CreateWarehouseRequestModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  warehouseOptions,
  branchOptions,
  currentUserBranchId,
}: Props) {
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateWarehouseRequestFormValues>({
    resolver: zodResolver(CreateWarehouseRequestFormSchema),
    defaultValues: {
      warehouseId: '',
      branchId: currentUserBranchId ?? '',
      notes: '',
      lines: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const branchId = useWatch({ control, name: 'branchId' })
  const warehouseId = useWatch({ control, name: 'warehouseId' })

  const [itemLabels, setItemLabels] = useState<Record<string, ItemLabel>>({})
  const [serialLabels, setSerialLabels] = useState<Record<string, string>>({})

  // "Add Item" flow state — pick an item, then (for the always-serial-
  // tracked catalog) multi-select which specific units, which auto-expands
  // into one line per unit picked rather than one line per click.
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [addingItemId, setAddingItemId] = useState('')
  const [manualQty, setManualQty] = useState(1)

  // One picker, always visible — warehouse-region-scoped delivery vs.
  // branch-side request is no longer something the user declares up front.
  const effectiveRegion = branchOptions.find((b) => b.id === branchId)?.region
  const defaultWarehouseId = warehouseOptions.find((w) => w.region === effectiveRegion)?.id

  useEffect(() => {
    if (isOpen) {
      reset({
        warehouseId: '',
        branchId: currentUserBranchId ?? '',
        notes: '',
        lines: [],
      })
      setItemLabels({})
      setSerialLabels({})
      // Opens the item picker immediately — a request always needs at least
      // one line, so starting with zero and requiring an extra click just to
      // see the first search box is a needless hurdle.
      setIsAddingItem(true)
      setAddingItemId('')
    }
  }, [isOpen, reset, currentUserBranchId])

  // Re-defaults the warehouse whenever the selected branch's region resolves
  // or changes — still a normal editable select, not locked, so a regional
  // stockout can be worked around by picking the other warehouse.
  useEffect(() => {
    if (isOpen && defaultWarehouseId) {
      setValue('warehouseId', defaultWarehouseId, { shouldValidate: true })
    }
  }, [isOpen, defaultWarehouseId, setValue])

  const addingItemDetailQuery = useQuery({
    queryKey: ['inventory-item-detail', addingItemId],
    queryFn: () => getItem(addingItemId),
    enabled: !!addingItemId,
    staleTime: 5 * 60 * 1000,
  })
  const addingItem = addingItemDetailQuery.data?.data
  const isAddingItemSerialTracked = addingItem?.isSerialTracked ?? false

  function confirmSerialAdd(serials: { id: string; serialNumber: string }[]) {
    if (!addingItem) return
    setItemLabels((prev) => ({
      ...prev,
      [addingItem.id]: { name: addingItem.name, sku: addingItem.sku },
    }))
    setSerialLabels((prev) => {
      const next = { ...prev }
      for (const s of serials) next[s.id] = s.serialNumber
      return next
    })
    for (const s of serials) {
      append({ itemId: addingItemId, quantity: 1, serialNumberId: s.id })
    }
    setAddingItemId('')
    setIsAddingItem(false)
  }

  function confirmManualAdd() {
    if (!addingItem || manualQty <= 0) return
    setItemLabels((prev) => ({
      ...prev,
      [addingItem.id]: { name: addingItem.name, sku: addingItem.sku },
    }))
    append({ itemId: addingItemId, quantity: manualQty })
    setAddingItemId('')
    setManualQty(1)
    setIsAddingItem(false)
  }

  function cancelAddItem() {
    setAddingItemId('')
    setIsAddingItem(false)
  }

  // Groups the flat `lines` array by item for display — "Item X — 3 units:
  // SN001, SN002, SN003" reads far better than 3 identical-looking rows.
  const groupedLines = useMemo(() => {
    const groups = new Map<
      string,
      {
        itemId: string
        itemName: string
        itemSku?: string
        entries: { index: number; serialNumber?: string; quantity: number }[]
      }
    >()
    fields.forEach((field, index) => {
      const itemLabel = itemLabels[field.itemId]
      const key = field.itemId
      const existing = groups.get(key)
      const entry = {
        index,
        serialNumber: field.serialNumberId ? serialLabels[field.serialNumberId] : undefined,
        quantity: field.quantity,
      }
      if (existing) {
        existing.entries.push(entry)
      } else {
        groups.set(key, {
          itemId: field.itemId,
          itemName: itemLabel?.name ?? field.itemId,
          itemSku: itemLabel?.sku,
          entries: [entry],
        })
      }
    })
    return Array.from(groups.values())
  }, [fields, itemLabels, serialLabels])

  if (!isOpen) return null

  async function handleFormSubmit(data: CreateWarehouseRequestFormValues) {
    const result = await onSubmit({
      ...data,
      branchId: data.branchId || undefined,
      notes: data.notes || undefined,
    })
    if (result.success) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Move Stock — Warehouse ↔ Branch</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Request stock from a warehouse, or record a delivery to a branch.
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Branch <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="branchId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="">Select branch…</option>
                      {branchOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {errors.branchId && (
                  <p className="mt-1 text-xs text-red-600">{errors.branchId.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Warehouse <span className="text-red-500">*</span>
                </label>
                <Controller
                  name="warehouseId"
                  control={control}
                  render={({ field }) => (
                    <select {...field} className={`${fieldClass} bg-white`}>
                      <option value="">Select warehouse…</option>
                      {warehouseOptions.map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name}
                        </option>
                      ))}
                    </select>
                  )}
                />
                {defaultWarehouseId && (
                  <p className="mt-1 text-xs text-zinc-400">
                    Defaulted to the branch&apos;s region — change it if you need the other one.
                  </p>
                )}
                {errors.warehouseId && (
                  <p className="mt-1 text-xs text-red-600">{errors.warehouseId.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Notes</label>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <input
                    {...field}
                    type="text"
                    placeholder="e.g. Running low ahead of the weekend rush"
                    className={fieldClass}
                  />
                )}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700">
                  Items <span className="text-red-500">*</span>
                </label>
                {!isAddingItem && (
                  <button
                    type="button"
                    onClick={() => setIsAddingItem(true)}
                    disabled={!warehouseId}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Item
                  </button>
                )}
              </div>
              {errors.lines?.root && (
                <p className="mb-2 text-xs text-red-600">{errors.lines.root.message}</p>
              )}
              {typeof errors.lines?.message === 'string' && (
                <p className="mb-2 text-xs text-red-600">{errors.lines.message}</p>
              )}

              {groupedLines.length > 0 && (
                <div className="mb-3 space-y-2">
                  {groupedLines.map((group) => (
                    <div key={group.itemId} className="rounded-lg border border-zinc-100 p-2.5">
                      <div className="flex items-start gap-2">
                        <Package className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-zinc-800">
                            {group.itemName}
                            {group.itemSku && (
                              <span className="ml-1.5 text-xs font-normal text-zinc-400">
                                {group.itemSku}
                              </span>
                            )}
                            <span className="ml-1.5 text-xs font-normal text-zinc-500">
                              — {group.entries.length} unit{group.entries.length === 1 ? '' : 's'}
                            </span>
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {group.entries.map((entry) => (
                              <span
                                key={entry.index}
                                className="flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-600"
                              >
                                {entry.serialNumber ?? `×${entry.quantity}`}
                                <button
                                  type="button"
                                  onClick={() => remove(entry.index)}
                                  className="text-zinc-400 hover:text-red-500"
                                  aria-label={`Remove ${entry.serialNumber ?? 'unit'}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isAddingItem && !warehouseId && (
                <p className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-400">
                  Pick a branch and warehouse above before adding items.
                </p>
              )}

              {isAddingItem && warehouseId && (
                <div className="space-y-3 rounded-lg border border-zinc-100 p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <ItemSearchCombobox
                        value={addingItemId}
                        onChange={(id) => setAddingItemId(id)}
                      />
                    </div>
                    {!addingItemId && (
                      <button
                        type="button"
                        onClick={cancelAddItem}
                        aria-label="Cancel adding item"
                        className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {addingItemDetailQuery.isLoading && (
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading item…
                    </div>
                  )}

                  {addingItem && isAddingItemSerialTracked && (
                    <SerialMultiPicker
                      warehouseId={warehouseId}
                      itemId={addingItem.id}
                      itemName={addingItem.name}
                      onConfirm={confirmSerialAdd}
                      onCancel={cancelAddItem}
                    />
                  )}

                  {addingItem && !isAddingItemSerialTracked && (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={manualQty}
                        onChange={(e) => setManualQty(Number(e.target.value) || 1)}
                        className={`${fieldClass} w-24`}
                      />
                      <button
                        type="button"
                        onClick={cancelAddItem}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={confirmManualAdd}
                        className="rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-prominent-purple-800"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              )}
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
              disabled={isSubmitting || fields.length === 0}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
