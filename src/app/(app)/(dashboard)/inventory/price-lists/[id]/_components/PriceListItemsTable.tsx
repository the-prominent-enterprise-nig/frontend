'use client'

import { useState } from 'react'
import { Loader2, Search, Trash2 } from 'lucide-react'
import type { PriceListItem } from '@/src/schema/inventory/price-lists'

function money(value: string | number | null | undefined) {
  if (value == null) return '—'
  return `₱${Number(value).toLocaleString()}`
}

type Props = {
  items: PriceListItem[]
  total: number
  page: number
  setPage: (page: number) => void
  totalPages: number
  search: string
  setSearch: (search: string) => void
  isLoading: boolean
  isFetching: boolean
  canEdit: boolean
  onRemoveOne: (itemId: string) => void
  onRemoveMany: (itemIds: string[]) => void
  isRemovingMany: boolean
}

export function PriceListItemsTable({
  items,
  total,
  page,
  setPage,
  totalPages,
  search,
  setSearch,
  isLoading,
  isFetching,
  canEdit,
  onRemoveOne,
  onRemoveMany,
  isRemovingMany,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

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

  const allOnPageSelected = items.length > 0 && items.every((i) => selected.has(i.itemId))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items by name or SKU…"
            className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
          />
        </div>
        {canEdit && selected.size > 0 && (
          <button
            type="button"
            onClick={handleRemoveSelected}
            disabled={isRemovingMany}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {isRemovingMany && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <Trash2 className="h-3.5 w-3.5" />
            Remove {selected.size} item{selected.size === 1 ? '' : 's'}
          </button>
        )}
      </div>

      <div
        className={`overflow-hidden rounded-xl border border-zinc-200 bg-white transition-opacity ${isFetching ? 'opacity-60' : ''}`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-zinc-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-sm text-zinc-400">
            {search ? `No items match "${search}"` : 'No items yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                <tr>
                  {canEdit && (
                    <th className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleAllOnPage}
                        aria-label="Select all items on this page"
                        className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700 focus:ring-prominent-purple-600"
                      />
                    </th>
                  )}
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Floor Price</th>
                  <th className="px-4 py-2">Down Payment</th>
                  <th className="px-4 py-2">Min Qty</th>
                  <th className="px-4 py-2">CM</th>
                  <th className="px-4 py-2">Credit</th>
                  {canEdit && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((i) => (
                  <tr key={i.id} className="hover:bg-zinc-50">
                    {canEdit && (
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(i.itemId)}
                          onChange={() => toggleOne(i.itemId)}
                          aria-label={`Select ${i.item.name}`}
                          className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700 focus:ring-prominent-purple-600"
                        />
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <div className="font-medium text-zinc-800">{i.item.name}</div>
                      <div className="text-xs text-zinc-400">{i.item.sku}</div>
                    </td>
                    <td className="px-4 py-2 text-zinc-600">{money(i.price)}</td>
                    <td className="px-4 py-2 text-zinc-600">{money(i.floorPrice)}</td>
                    <td className="px-4 py-2 text-zinc-600">{money(i.downPayment)}</td>
                    <td className="px-4 py-2 text-zinc-600">{i.minQty ?? '—'}</td>
                    <td className="px-4 py-2 text-zinc-600">{money(i.cmAmount)}</td>
                    <td className="px-4 py-2 text-zinc-600">{money(i.creditAmount)}</td>
                    {canEdit && (
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveOne(i)}
                          title="Remove"
                          className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500">
            <span>
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
