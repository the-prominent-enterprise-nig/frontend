'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { getItems } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-items'
import type { ApiResponse } from '@/src/libs/api/client'
import type { UpsertPriceListItemFormValues } from '@/src/schema/inventory/price-lists'

type SearchResult = { id: string; name: string; sku: string }

type FieldKey = 'price' | 'floorPrice' | 'downPayment' | 'minQty' | 'cmAmount' | 'creditAmount'

type StagedItem = { itemId: string; name: string; sku: string } & Record<FieldKey, string>

const EMPTY_FIELDS: Record<FieldKey, string> = {
  price: '',
  floorPrice: '',
  downPayment: '',
  minQty: '',
  cmAmount: '',
  creditAmount: '',
}

const FIELD_COLUMNS: { key: FieldKey; label: string; required?: boolean }[] = [
  { key: 'price', label: 'Price', required: true },
  { key: 'floorPrice', label: 'Floor Price' },
  { key: 'downPayment', label: 'Down Payment' },
  { key: 'minQty', label: 'Min Qty' },
  { key: 'cmAmount', label: 'CM' },
  { key: 'creditAmount', label: 'Credit' },
]

const fieldInputClass =
  'w-24 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

type Props = {
  onAdd: (items: UpsertPriceListItemFormValues[]) => Promise<ApiResponse<unknown>>
  isAdding: boolean
}

export function AddItemsPanel({ onAdd, isAdding }: Props) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [staged, setStaged] = useState<StagedItem[]>([])
  const [applyAll, setApplyAll] = useState<Record<FieldKey, string>>(EMPTY_FIELDS)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!showResults) return
    let cancelled = false
    async function run() {
      setIsSearching(true)
      const res = await getItems({
        search: debouncedQuery || undefined,
        limit: 10,
        lifecycle: 'active',
      })
      if (!cancelled) {
        setResults((res.data?.data ?? []).map((i) => ({ id: i.id, name: i.name, sku: i.sku })))
        setIsSearching(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, showResults])

  function stageItem(item: SearchResult) {
    setStaged((s) =>
      s.some((i) => i.itemId === item.id)
        ? s
        : [...s, { itemId: item.id, name: item.name, sku: item.sku, ...EMPTY_FIELDS }]
    )
    setQuery('')
    setShowResults(false)
  }

  function unstageItem(itemId: string) {
    setStaged((s) => s.filter((i) => i.itemId !== itemId))
  }

  function updateStagedField(itemId: string, field: FieldKey, value: string) {
    setStaged((s) => s.map((i) => (i.itemId === itemId ? { ...i, [field]: value } : i)))
  }

  function applyToAll(field: FieldKey) {
    const value = applyAll[field]
    if (value === '') return
    setStaged((s) => s.map((i) => ({ ...i, [field]: value })))
  }

  const canSubmit = staged.length > 0 && staged.every((i) => i.price !== '')

  async function handleSubmit() {
    if (!canSubmit) return
    const items: UpsertPriceListItemFormValues[] = staged.map((s) => ({
      itemId: s.itemId,
      price: Number(s.price),
      floorPrice: s.floorPrice ? Number(s.floorPrice) : undefined,
      downPayment: s.downPayment ? Number(s.downPayment) : undefined,
      minQty: s.minQty ? Number(s.minQty) : undefined,
      cmAmount: s.cmAmount ? Number(s.cmAmount) : undefined,
      creditAmount: s.creditAmount ? Number(s.creditAmount) : undefined,
    }))
    const result = await onAdd(items)
    if (result.success) {
      setStaged([])
      setApplyAll(EMPTY_FIELDS)
    }
  }

  const visibleResults = results.filter((r) => !staged.some((s) => s.itemId === r.id))

  return (
    <div className="space-y-4 rounded-xl border border-prominent-purple-200 bg-prominent-purple-50 p-4">
      <div className="relative">
        <label htmlFor="add-items-search" className="mb-1 block text-xs font-medium text-zinc-600">
          Search items to add
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            id="add-items-search"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowResults(true)
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Search item by name or SKU…"
            className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
          />
        </div>
        {showResults && (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
            {isSearching ? (
              <div className="flex items-center justify-center py-4 text-zinc-400">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : visibleResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-zinc-400">No items found</div>
            ) : (
              visibleResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => stageItem(item)}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-prominent-purple-50"
                >
                  <span className="font-medium text-zinc-800">{item.name}</span>
                  <span className="text-xs text-zinc-400">{item.sku}</span>
                </button>
              ))
            )}
          </div>
        )}
        {showResults && (
          <button
            type="button"
            onClick={() => setShowResults(false)}
            className="absolute right-2 top-8 rounded p-1 text-zinc-400 hover:bg-zinc-100"
            title="Close search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {staged.length > 0 && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  {FIELD_COLUMNS.map((col) => (
                    <th key={col.key} className="px-3 py-2">
                      {col.label}
                      {col.required && <span className="text-red-500"> *</span>}
                    </th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {/* Apply-to-all row: set one value here and stamp it across every staged row below. */}
                <tr className="bg-zinc-50/60">
                  <td className="px-3 py-2 text-xs italic text-zinc-500">Apply to all</td>
                  {FIELD_COLUMNS.map((col) => (
                    <td key={col.key} className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={applyAll[col.key]}
                          onChange={(e) =>
                            setApplyAll((a) => ({ ...a, [col.key]: e.target.value }))
                          }
                          placeholder="0.00"
                          className={fieldInputClass}
                        />
                        <button
                          type="button"
                          onClick={() => applyToAll(col.key)}
                          disabled={applyAll[col.key] === ''}
                          title={`Apply ${col.label} to all rows`}
                          className="rounded px-1.5 py-1 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-100 disabled:opacity-40"
                        >
                          Apply
                        </button>
                      </div>
                    </td>
                  ))}
                  <td />
                </tr>
                {staged.map((item) => (
                  <tr key={item.itemId} className="hover:bg-zinc-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-zinc-800">{item.name}</div>
                      <div className="text-xs text-zinc-400">{item.sku}</div>
                    </td>
                    {FIELD_COLUMNS.map((col) => (
                      <td key={col.key} className="px-3 py-2">
                        <input
                          aria-label={`${col.label} for ${item.name}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item[col.key]}
                          onChange={(e) => updateStagedField(item.itemId, col.key, e.target.value)}
                          placeholder="0.00"
                          className={fieldInputClass}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => unstageItem(item.itemId)}
                        title="Remove from batch"
                        className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isAdding}
              className="flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
            >
              {isAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isAdding ? 'Adding…' : `Add ${staged.length} Item${staged.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
