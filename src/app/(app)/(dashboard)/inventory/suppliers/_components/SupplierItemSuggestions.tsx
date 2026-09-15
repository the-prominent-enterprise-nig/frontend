'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, Search, X, History, Tag } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import Tooltip from '@/src/components/ui/Tooltip'
import {
  getSupplierItemSuggestions,
  bulkAddSupplierItems,
  type SupplierItemSuggestion,
} from '../_actions/get-supplier-items'

/**
 * Proposes items this supplier likely carries — from real purchase history,
 * and from brand names that match the supplier's — and links the ones a user
 * ticks. The client's master data never recorded who supplies what, so this
 * is how a 2,700-item catalog gets its supplier links without 2,700 manual
 * picks. Purchase-history rows are proven and start ticked; brand rows are a
 * naming guess and start unticked on purpose.
 */
export default function SupplierItemSuggestions({
  supplierId,
  onClose,
  onLinked,
}: {
  supplierId: string
  onClose: () => void
  onLinked: () => void
}) {
  const [suggestions, setSuggestions] = useState<SupplierItemSuggestion[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    const res = await getSupplierItemSuggestions(supplierId)
    const list = res.data ?? []
    setSuggestions(list)
    setSelected(new Set(list.filter((s) => s.source === 'purchase_history').map((s) => s.itemId)))
    setIsLoading(false)
  }, [supplierId])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return suggestions
    return suggestions.filter((s) =>
      `${s.sku} ${s.name} ${s.brandName ?? ''}`.toLowerCase().includes(q)
    )
  }, [suggestions, search])

  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.itemId))

  function toggleOne(itemId: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  function toggleAllVisible(): void {
    setSelected((prev) => {
      const next = new Set(prev)
      visible.forEach((s) => (allVisibleSelected ? next.delete(s.itemId) : next.add(s.itemId)))
      return next
    })
  }

  async function handleLink(): Promise<void> {
    const picked = suggestions.filter((s) => selected.has(s.itemId))
    if (picked.length === 0) return

    setIsSaving(true)
    const res = await bulkAddSupplierItems(
      supplierId,
      picked.map((s) => ({
        itemId: s.itemId,
        unitPrice: s.suggestedUnitPrice ?? undefined,
        notes: s.reason,
      }))
    )
    setIsSaving(false)

    if (res.success) {
      showToast({
        title: `${res.data?.created ?? picked.length} item(s) linked`,
        description: res.data?.skipped ? `${res.data.skipped} already linked` : undefined,
        status: 'success',
      })
      onLinked()
    } else {
      showToast({ title: 'Failed to link items', description: res.message, status: 'error' })
    }
  }

  if (isLoading)
    return (
      <div className="flex items-center justify-center rounded-xl border border-zinc-200 py-10 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )

  return (
    <div className="space-y-3 rounded-xl border border-prominent-purple-200 bg-prominent-purple-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-zinc-800">Suggested items</h4>
          <p className="mt-0.5 text-xs text-zinc-500">
            {suggestions.length === 0
              ? 'Nothing to suggest — no purchase history, and no item brand matches this supplier’s name.'
              : 'From past purchases and matching brand names. Review before linking — brand matches are a guess.'}
          </p>
        </div>
        <Tooltip label="Close suggestions" side="bottom" align="end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close suggestions"
            className="rounded p-1 text-zinc-400 hover:bg-white hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>

      {suggestions.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by SKU, name, or brand…"
                className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-prominent-purple-500"
              />
            </div>
            <button
              type="button"
              onClick={toggleAllVisible}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              {allVisibleSelected ? 'Clear' : 'Select'} {visible.length} shown
            </button>
          </div>

          <div className="max-h-80 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 bg-white">
            {visible.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-400">No suggestion matches.</p>
            ) : (
              visible.map((s) => (
                <label
                  key={s.itemId}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-zinc-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.itemId)}
                    onChange={() => toggleOne(s.itemId)}
                    className="h-4 w-4 rounded border-zinc-300 accent-prominent-purple-700"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-800">{s.name}</span>
                    <span className="block text-xs text-zinc-400">
                      {s.sku}
                      {s.brandName ? ` · ${s.brandName}` : ''}
                    </span>
                  </span>
                  {s.suggestedUnitPrice != null && (
                    <span className="shrink-0 text-xs text-zinc-500">
                      ₱{Number(s.suggestedUnitPrice).toLocaleString()}
                    </span>
                  )}
                  <SourceBadge source={s.source} title={s.reason} />
                </label>
              ))
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-zinc-500">{selected.size} selected</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLink}
                disabled={isSaving || selected.size === 0}
                className="flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
              >
                {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                Link {selected.size} item(s)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SourceBadge({
  source,
  title,
}: {
  source: SupplierItemSuggestion['source']
  title: string
}): React.ReactElement {
  const isHistory = source === 'purchase_history'
  const Icon = isHistory ? History : Tag

  return (
    <Tooltip label={title} align="end" className="shrink-0">
      <span
        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          isHistory ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}
      >
        <Icon className="h-3 w-3" />
        {isHistory ? 'Purchased' : 'Brand match'}
      </span>
    </Tooltip>
  )
}
