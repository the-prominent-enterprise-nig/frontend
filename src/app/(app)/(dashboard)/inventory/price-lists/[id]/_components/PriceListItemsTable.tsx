'use client'

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import type {
  PriceListItem,
  UpsertPriceListItemFormValues,
} from '@/src/schema/inventory/price-lists'
import type { ApiResponse } from '@/src/libs/api/client'
import { MONO } from '@/src/libs/design/plex'

function money(value: string | number | null | undefined) {
  if (value == null) return '—'
  return `₱${Number(value).toLocaleString()}`
}

/** The server sends numbers as strings or numbers depending on the column;
 * normalise both to the plain text an <input> holds, with null/undefined as
 * "" so a blank optional field stays blank rather than showing "null". */
function toText(value: string | number | null | undefined) {
  return value == null ? '' : String(value)
}

type FieldKey = 'price' | 'downPayment' | 'minQty' | 'cmAmount' | 'creditAmount'

type Draft = Record<FieldKey, string>

const FIELDS: { key: FieldKey; label: string; required?: boolean }[] = [
  { key: 'price', label: 'Price', required: true },
  { key: 'downPayment', label: 'Down Payment' },
  { key: 'minQty', label: 'Min Qty' },
  { key: 'cmAmount', label: 'CM' },
  { key: 'creditAmount', label: 'Credit' },
]

function draftFromItem(item: PriceListItem): Draft {
  return {
    price: toText(item.price),
    downPayment: toText(item.downPayment),
    minQty: toText(item.minQty),
    cmAmount: toText(item.cmAmount),
    creditAmount: toText(item.creditAmount),
  }
}

function sameDraft(a: Draft, b: Draft) {
  return FIELDS.every((field) => a[field.key].trim() === b[field.key].trim())
}

function optionalNumber(value: string) {
  const trimmed = value.trim()
  return trimmed === '' ? undefined : Number(trimmed)
}

type Props = {
  items: PriceListItem[]
  total: number
  page: number
  setPage: (page: number) => void
  totalPages: number
  /** Only for the empty state's wording — the input itself is the page's. */
  search: string
  isLoading: boolean
  isFetching: boolean
  canEdit: boolean
  onRemoveOne: (itemId: string) => void
  onRemoveMany: (itemIds: string[]) => void
  isRemovingMany: boolean
  onSave: (items: UpsertPriceListItemFormValues[]) => Promise<ApiResponse<unknown>>
  isSaving: boolean
  /** Copy for the save bar — an active list drops back to Pending Approval
   * on save, and the reader should know that before clicking, not after. */
  savingRevertsToPending: boolean
}

export function PriceListItemsTable({
  items,
  total,
  page,
  setPage,
  totalPages,
  search,
  isLoading,
  isFetching,
  canEdit,
  onRemoveOne,
  onRemoveMany,
  isRemovingMany,
  onSave,
  isSaving,
  savingRevertsToPending,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Only rows the reader has actually touched live here. Everything else
  // renders straight from the server copy, so a background refetch can
  // update untouched rows without stamping over anything being typed.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})

  function toggleOne(itemId: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  function toggleAllOnPage() {
    setSelected((s) => {
      const pageIds = items.map((i) => i.itemId)
      const allSelected = pageIds.every((id) => s.has(id))
      if (allSelected) return new Set([...s].filter((id) => !pageIds.includes(id)))
      return new Set([...s, ...pageIds])
    })
  }

  function handleRemoveSelected() {
    const ids = [...selected]
    if (ids.length === 0) return
    if (!confirm(`Remove ${ids.length} item(s) from this price list?`)) return
    onRemoveMany(ids)
    setSelected(new Set())
  }

  function handleRemoveOne(item: PriceListItem) {
    if (!confirm(`Remove ${item.item.name} from this price list?`)) return
    onRemoveOne(item.itemId)
  }

  function draftFor(item: PriceListItem): Draft {
    return drafts[item.itemId] ?? draftFromItem(item)
  }

  function updateField(item: PriceListItem, key: FieldKey, value: string) {
    setDrafts((current) => ({
      ...current,
      [item.itemId]: { ...draftFor(item), [key]: value },
    }))
  }

  const editedItems = items.filter(
    (item) => drafts[item.itemId] && !sameDraft(drafts[item.itemId], draftFromItem(item))
  )
  const invalidItems = editedItems.filter((item) => {
    const price = draftFor(item).price.trim()
    return price === '' || Number.isNaN(Number(price)) || Number(price) < 0
  })
  const isDirty = editedItems.length > 0

  async function handleSave() {
    if (!isDirty || invalidItems.length > 0) return
    const payload: UpsertPriceListItemFormValues[] = editedItems.map((item) => {
      const draft = draftFor(item)
      return {
        itemId: item.itemId,
        price: Number(draft.price),
        downPayment: optionalNumber(draft.downPayment),
        minQty: optionalNumber(draft.minQty),
        cmAmount: optionalNumber(draft.cmAmount),
        creditAmount: optionalNumber(draft.creditAmount),
      }
    })
    const result = await onSave(payload)
    if (result.success) setDrafts({})
  }

  const allOnPageSelected = items.length > 0 && items.every((i) => selected.has(i.itemId))
  const cellInputClass = `w-24 rounded-lg border border-[#d3d3db] px-2 py-1.5 text-right text-sm ${MONO} outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]`

  return (
    <div className="space-y-3">
      {/* The search box that used to sit here now lives in the page's own
          toolbar, beside the Filter/Add switch — two boxes a few pixels
          apart, one searching this list and one searching the catalog, read
          as the same control twice. */}
      <div className="flex flex-wrap items-center justify-end gap-2 empty:hidden">
        {canEdit && selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-[#ddd0f7] bg-[#f1ebfb] px-3 py-1.5">
            <span className="text-xs font-medium text-[#3f1490]">{selected.size} selected</span>
            <button
              type="button"
              onClick={handleRemoveSelected}
              disabled={isRemovingMany}
              className="flex items-center gap-1.5 rounded-lg border border-[#f3c9c5] bg-white px-3 py-1 text-xs font-medium text-[#b42318] hover:bg-[#fdeceb] disabled:opacity-60"
            >
              {isRemovingMany && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Trash2 className="h-3.5 w-3.5" />
              Remove {selected.size} item{selected.size === 1 ? '' : 's'}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-lg px-2 py-1 text-xs text-[#5b5b6b] hover:text-[#17171c]"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      <div
        className={`overflow-hidden rounded-xl border border-[#e4e4e9] bg-white transition-opacity ${isFetching ? 'opacity-60' : ''}`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#8b8b9b]">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[#3d3d4a]">
              {search ? `No items match "${search}"` : 'No items priced yet'}
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-[#5b5b6b]">
              {search
                ? 'Only this list is searched — an item missing here may still exist in the catalog.'
                : 'Until an item is priced here, a sale under this use type falls through to the next list by priority.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead
                className={`bg-[#fbfbfc] text-left ${MONO} text-[10px] font-semibold uppercase tracking-[0.09em] text-[#5b5b6b]`}
              >
                <tr>
                  {canEdit && (
                    <th className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleAllOnPage}
                        aria-label="Select all items on this page"
                        className="h-4 w-4 rounded border-[#d3d3db] text-[#3f1490] focus:ring-[#5b21b6]"
                      />
                    </th>
                  )}
                  <th className="px-4 py-2">Item</th>
                  {FIELDS.map((field) => (
                    <th key={field.key} className="px-4 py-2 text-right">
                      {field.label}
                    </th>
                  ))}
                  {canEdit && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eeeef1]">
                {items.map((i) => {
                  const draft = draftFor(i)
                  const isRowDirty = drafts[i.itemId] && !sameDraft(draft, draftFromItem(i))
                  const priceInvalid =
                    isRowDirty &&
                    (draft.price.trim() === '' ||
                      Number.isNaN(Number(draft.price)) ||
                      Number(draft.price) < 0)
                  return (
                    <tr
                      key={i.id}
                      className={isRowDirty ? 'bg-[#fdf3e7]/60' : 'hover:bg-[#fbfbfc]'}
                    >
                      {canEdit && (
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(i.itemId)}
                            onChange={() => toggleOne(i.itemId)}
                            aria-label={`Select ${i.item.name}`}
                            className="h-4 w-4 rounded border-[#d3d3db] text-[#3f1490] focus:ring-[#5b21b6]"
                          />
                        </td>
                      )}
                      <td className="px-4 py-2">
                        <div className="font-medium text-[#3d3d4a]">{i.item.name}</div>
                        <div className="text-xs text-[#8b8b9b]">{i.item.sku}</div>
                      </td>
                      {FIELDS.map((field) => (
                        <td key={field.key} className="px-4 py-2 text-right">
                          {canEdit ? (
                            <input
                              // Distinct from the Add-items panel's staged
                              // inputs, which use "Price for X" — the same
                              // item can legitimately appear in both at once.
                              aria-label={`${field.label} for ${i.item.name} in this list`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={draft[field.key]}
                              onChange={(e) => updateField(i, field.key, e.target.value)}
                              placeholder={field.required ? '0.00' : '—'}
                              className={`${cellInputClass} ${
                                field.key === 'price' && priceInvalid
                                  ? 'border-[#eda9a2] bg-[#fdeceb]'
                                  : ''
                              }`}
                            />
                          ) : field.key === 'minQty' ? (
                            <span className="text-[#5b5b6b]">{i.minQty ?? '—'}</span>
                          ) : (
                            <span className="text-[#5b5b6b]">
                              {money(i[field.key as keyof PriceListItem] as string | number | null)}
                            </span>
                          )}
                        </td>
                      ))}
                      {canEdit && (
                        <td className="px-4 py-2">
                          <Tooltip label="Remove from this list" side="top" align="end">
                            <button
                              type="button"
                              onClick={() => handleRemoveOne(i)}
                              aria-label={`Remove ${i.item.name}`}
                              className="rounded p-1 text-[#8b8b9b] hover:bg-[#fdeceb] hover:text-[#b42318]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </Tooltip>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#eeeef1] px-4 py-3 text-sm text-[#5b5b6b]">
            <span>
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-lg px-3 py-1.5 hover:bg-[#f1f1f4] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="rounded-lg px-3 py-1.5 hover:bg-[#f1f1f4] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Unsaved-edit bar. Sticky rather than a toast: the edits are spread
          down the table, so the one control that commits them has to stay
          within reach no matter how far the reader has scrolled. */}
      {canEdit && isDirty && (
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f5e2c6] bg-white px-4 py-3 shadow-lg">
          <div className="min-w-0">
            <p className="text-xs text-[#8a4b06]">
              {invalidItems.length > 0
                ? `${invalidItems.length} row${invalidItems.length === 1 ? '' : 's'} need a price before this can be saved`
                : savingRevertsToPending
                  ? 'This list is live — saving sends it back for approval'
                  : 'Unsaved changes'}
            </p>
            <p className="text-sm font-semibold text-[#17171c]">
              {editedItems.length} item{editedItems.length === 1 ? '' : 's'} edited
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrafts({})}
              disabled={isSaving}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[#5b5b6b] hover:bg-[#f1f1f4] disabled:opacity-50"
            >
              Discard changes
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || invalidItems.length > 0}
              className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a189b] disabled:opacity-60"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSaving
                ? 'Saving…'
                : savingRevertsToPending
                  ? 'Save and re-submit'
                  : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
