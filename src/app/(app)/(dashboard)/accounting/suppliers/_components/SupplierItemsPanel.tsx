'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Search, Sparkles, Star, Trash2 } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import { ConfirmDialog } from '@/src/components/ui/Modal'
import Tooltip from '@/src/components/ui/Tooltip'
import { SearchCombobox, type SearchComboboxOption } from '@/src/components/ui/SearchCombobox'
import { MONO } from '@/src/libs/design/plex'
import SupplierItemSuggestions from './SupplierItemSuggestions'
import {
  addSupplierItem,
  getSupplierItems,
  removeSupplierItem,
  type SupplierItemMapping,
} from '../_actions/get-supplier-items'

type ItemOption = { id: string; name: string; sku: string }

/** A supplier that carries the whole catalogue would otherwise print hundreds
 * of rows into a column 700px wide. Ten at a time, searchable — same treatment
 * the price-list items table gets, for the same reason. */
const PAGE_SIZE = 10

const fieldClass =
  'w-full rounded-lg border border-[#d3d3db] bg-white px-2.5 py-1.5 text-[13px] text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]'
const labelClass = 'block text-[11px] font-medium text-[#3d3d4a]'

const emptyForm = {
  itemId: '',
  supplierSku: '',
  unitPrice: '',
  leadTimeDays: '',
  isPreferred: false,
  notes: '',
}

/** "₱12,500 · SKU BEK-090 · 7d lead" — one line of whatever this mapping
 * actually holds, instead of four mostly-empty table columns. */
function mappingMeta(mapping: SupplierItemMapping): string[] {
  const parts: string[] = []
  if (mapping.supplierSku?.trim()) parts.push(`Their SKU ${mapping.supplierSku.trim()}`)
  if (mapping.unitPrice != null) parts.push(`₱${Number(mapping.unitPrice).toLocaleString('en-US')}`)
  if (mapping.leadTimeDays != null) parts.push(`${mapping.leadTimeDays}d lead`)
  return parts
}

/**
 * The items this supplier carries — what a purchase order raised against them
 * is allowed to hold.
 *
 * A row, not a table cell, per mapping: this panel shares the screen with the
 * supplier list, so there is no room to scan six columns across. Everything the
 * old table showed is still here, printed as the one line of facts a buyer
 * reads before picking the item.
 */
export default function SupplierItemsPanel({
  supplierId,
  itemOptions,
  canUpdate,
}: {
  supplierId: string
  itemOptions: ItemOption[]
  canUpdate: boolean
}) {
  const [mappings, setMappings] = useState<SupplierItemMapping[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [pendingRemoval, setPendingRemoval] = useState<SupplierItemMapping | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await getSupplierItems(supplierId)
    setMappings(res.data ?? [])
    setIsLoading(false)
  }, [supplierId])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return mappings
    return mappings.filter((m) =>
      `${m.item.sku} ${m.item.name} ${m.supplierSku ?? ''}`.toLowerCase().includes(q)
    )
  }, [mappings, search])

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  // Clamped on read rather than corrected in an effect: a search that shortens
  // the list, or a removal that empties the last page, would otherwise leave
  // the reader parked past the end of it for one render.
  const safePage = Math.min(page, totalPages)

  const pageStart = (safePage - 1) * PAGE_SIZE
  const paged = visible.slice(pageStart, pageStart + PAGE_SIZE)

  async function handleAdd() {
    if (!form.itemId) return
    setIsSaving(true)
    const res = await addSupplierItem(supplierId, {
      itemId: form.itemId,
      supplierSku: form.supplierSku || undefined,
      unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
      leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
      isPreferred: form.isPreferred,
      notes: form.notes || undefined,
    })
    setIsSaving(false)
    if (res.success) {
      showToast({ title: 'Item linked', status: 'success' })
      setForm(emptyForm)
      setShowAddForm(false)
      await load()
    } else {
      showToast({ title: 'Could not link the item', description: res.message, status: 'error' })
    }
  }

  async function handleRemove(mapping: SupplierItemMapping) {
    setIsSaving(true)
    const res = await removeSupplierItem(supplierId, mapping.itemId)
    setIsSaving(false)
    setPendingRemoval(null)
    if (res.success) {
      showToast({ title: 'Item unlinked', status: 'success' })
      await load()
    } else {
      showToast({ title: 'Could not unlink the item', description: res.message, status: 'error' })
    }
  }

  const linkedItemIds = new Set(mappings.map((m) => m.itemId))
  const availableItems = itemOptions.filter((i) => !linkedItemIds.has(i.id))

  /** Client-side filter over the already-loaded item list — a plain <select>
   * of 2,700 options is unusable, and the list is in memory already. */
  async function searchAvailableItems(query: string): Promise<SearchComboboxOption[]> {
    const q = query.trim().toLowerCase()
    return availableItems
      .filter((i) => !q || `${i.sku} ${i.name}`.toLowerCase().includes(q))
      .slice(0, 50)
      .map((i) => ({ id: i.id, primary: i.name, secondary: i.sku }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#8b8b9b]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* Head */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-[#17171c]">
            {mappings.length === 0
              ? 'No items linked'
              : `${mappings.length} ${mappings.length === 1 ? 'item' : 'items'} linked`}
          </p>
          <p className="text-[11.5px] leading-relaxed text-[#5b5b6b]">
            Only a linked item can go on a purchase order raised against this supplier.
          </p>
        </div>
        {canUpdate && !showAddForm && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSuggestions((open) => !open)}
              className="flex items-center gap-1.5 rounded-lg border border-[#ddd0f7] bg-white px-3 py-2 text-xs font-medium text-[#3f1490] hover:bg-[#f1ebfb]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {showSuggestions ? 'Hide suggestions' : 'Suggest items'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              disabled={availableItems.length === 0}
              title={
                availableItems.length === 0
                  ? 'Every active item is already linked'
                  : 'Link an item to this supplier'
              }
              className="flex items-center gap-1.5 rounded-lg bg-[#5b21b6] px-3 py-2 text-xs font-medium text-white hover:bg-[#4a189b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Link items
            </button>
          </div>
        )}
      </div>

      {/* Bulk-link suggestions — the only practical way to link a catalogue this
          size, since the client's master data has no supplier column. */}
      {canUpdate && showSuggestions && (
        <SupplierItemSuggestions
          supplierId={supplierId}
          onClose={() => setShowSuggestions(false)}
          onLinked={async () => {
            setShowSuggestions(false)
            await load()
          }}
        />
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="flex flex-col gap-3 rounded-xl border border-[#ddd0f7] bg-[#fcfaff] px-4 py-3.5">
          <p className="text-[12.5px] font-semibold text-[#3f1490]">Link an item</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>
                Item <span className="text-[#b42318]">*</span>
              </label>
              <SearchCombobox
                value={form.itemId}
                onChange={(id: string) => setForm((f) => ({ ...f, itemId: id }))}
                queryKey={`supplier-${supplierId}-item-picker`}
                search={searchAvailableItems}
                placeholder="Search by SKU or name…"
                emptyMessage="No unlinked item matches."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Their SKU</label>
              <input
                type="text"
                value={form.supplierSku}
                onChange={(e) => setForm((f) => ({ ...f, supplierSku: e.target.value }))}
                placeholder="The supplier's own code"
                className={fieldClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Unit price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
                placeholder="0.00"
                className={`${fieldClass} ${MONO} text-right`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Lead time (days)</label>
              <input
                type="number"
                min="0"
                value={form.leadTimeDays}
                onChange={(e) => setForm((f) => ({ ...f, leadTimeDays: e.target.value }))}
                placeholder="e.g. 7"
                className={fieldClass}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-[12px] text-[#3d3d4a]">
            <input
              type="checkbox"
              checked={form.isPreferred}
              onChange={(e) => setForm((f) => ({ ...f, isPreferred: e.target.checked }))}
              className="h-4 w-4 rounded border-[#d3d3db] accent-[#5b21b6]"
            />
            Preferred supplier for this item
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setForm(emptyForm)
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#5b5b6b] hover:bg-[#f1f1f4] hover:text-[#17171c]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isSaving || !form.itemId}
              className="flex items-center gap-1.5 rounded-lg bg-[#5b21b6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4a189b] disabled:opacity-60"
            >
              {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
              Link item
            </button>
          </div>
        </div>
      )}

      {/* Search — only once there is enough to hunt through. */}
      {mappings.length > PAGE_SIZE && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8b8b9b]" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search linked items by name or SKU…"
            aria-label="Search linked items"
            className="w-full rounded-lg border border-[#d3d3db] bg-white py-1.5 pl-9 pr-3 text-[13px] text-[#17171c] outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]"
          />
        </div>
      )}

      {/* Rows */}
      {mappings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d3d3db] px-5 py-10 text-center">
          <p className="text-sm font-medium text-[#3d3d4a]">No items linked yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#5b5b6b]">
            Link the items this supplier carries, or let the system suggest them from what has
            already been bought from them.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-[#e4e4e9] px-4 py-8 text-center text-[12.5px] text-[#5b5b6b]">
          No linked item matches &ldquo;{search}&rdquo;.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#e4e4e9]">
          <ul>
            {paged.map((mapping, index) => {
              const meta = mappingMeta(mapping)
              return (
                <li
                  key={mapping.id}
                  className={`bg-white ${index ? 'border-t border-[#f4f4f6]' : ''}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-1.5">
                        {mapping.isPreferred && (
                          <Tooltip
                            label="Preferred supplier for this item"
                            side="top"
                            align="start"
                          >
                            <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-[#e08a1e] text-[#e08a1e]" />
                          </Tooltip>
                        )}
                        <p
                          className="min-w-0 text-[12.5px] font-medium leading-snug text-[#17171c]"
                          title={mapping.item.name}
                        >
                          {mapping.item.name}
                        </p>
                      </div>
                      <p className={`${MONO} mt-1 text-[10.5px] text-[#5b5b6b]`}>
                        {mapping.item.sku}
                      </p>
                      {meta.length > 0 && (
                        <p className="mt-0.5 text-[10.5px] text-[#5b5b6b]">{meta.join(' · ')}</p>
                      )}
                    </div>
                    {canUpdate && (
                      <Tooltip label="Unlink from this supplier" side="top" align="end">
                        <button
                          type="button"
                          onClick={() => setPendingRemoval(mapping)}
                          aria-label={`Unlink ${mapping.item.name}`}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#a3a3b2] hover:bg-[#fdeceb] hover:text-[#b42318]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {(totalPages > 1 || search.trim() !== '') && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eeeef1] bg-[#fbfbfc] px-4 py-2.5 text-[11.5px] text-[#5b5b6b]">
              <span>
                {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, visible.length)} of{' '}
                {visible.length}
                {search.trim() !== '' && ` matching · ${mappings.length} linked`}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, safePage - 1))}
                    disabled={safePage <= 1}
                    className="rounded-lg px-2.5 py-1 font-medium hover:bg-[#f1f1f4] disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className={`${MONO} px-1 text-[11px]`}>
                    {safePage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                    disabled={safePage >= totalPages}
                    className="rounded-lg px-2.5 py-1 font-medium hover:bg-[#f1f1f4] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        title={pendingRemoval ? `Unlink ${pendingRemoval.item.name}?` : 'Unlink item'}
        message={
          <p>
            It can no longer be put on a purchase order for this supplier. Purchase orders that
            already hold it are untouched, and it can be linked again later.
          </p>
        }
        confirmLabel="Unlink"
        destructive
        loading={isSaving}
        onConfirm={() => pendingRemoval && handleRemove(pendingRemoval)}
        onCancel={() => setPendingRemoval(null)}
      />
    </div>
  )
}
