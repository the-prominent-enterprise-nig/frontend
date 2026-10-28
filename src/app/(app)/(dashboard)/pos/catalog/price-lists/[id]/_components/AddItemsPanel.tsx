'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Search, Trash2, X } from 'lucide-react'
import { getItems } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-items'
import type { ApiResponse } from '@/src/libs/api/client'
import type { UpsertPriceListItemFormValues } from '@/src/schema/inventory/price-lists'
import { MONO } from '@/src/libs/design/plex'

type SearchResult = { id: string; name: string; sku: string }

type FieldKey = 'price' | 'downPayment' | 'minQty' | 'cmAmount' | 'creditAmount'

type StagedItem = { itemId: string; name: string; sku: string } & Record<FieldKey, string>

const EMPTY_FIELDS: Record<FieldKey, string> = {
  price: '',
  downPayment: '',
  minQty: '',
  cmAmount: '',
  creditAmount: '',
}

type FieldColumn = { key: FieldKey; label: string; required?: boolean; step?: string }

const CORE_COLUMNS: FieldColumn[] = [
  { key: 'price', label: 'Price', required: true },
  { key: 'downPayment', label: 'Down Payment' },
]

const EXTRA_COLUMNS: FieldColumn[] = [
  { key: 'minQty', label: 'Min Qty', step: '1' },
  { key: 'cmAmount', label: 'CM' },
  { key: 'creditAmount', label: 'Credit' },
]

const FIELD_COLUMNS: FieldColumn[] = [...CORE_COLUMNS, ...EXTRA_COLUMNS]

const fieldInputClass = `w-full rounded-lg border border-[#d3d3db] px-2 py-1.5 text-right text-sm ${MONO} outline-none focus:border-[#5b21b6] focus:shadow-[0_0_0_3px_#f0e9fc]`

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
  const [showExtraFields, setShowExtraFields] = useState(true)

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

  const filledForAll = FIELD_COLUMNS.filter((col) => applyAll[col.key] !== '')

  function applyAllToRows() {
    if (filledForAll.length === 0) return
    const patch = Object.fromEntries(filledForAll.map((col) => [col.key, applyAll[col.key]]))
    setStaged((s) => s.map((i) => ({ ...i, ...patch })))
  }

  const canSubmit = staged.length > 0 && staged.every((i) => i.price !== '')

  async function handleSubmit() {
    if (!canSubmit) return
    const items: UpsertPriceListItemFormValues[] = staged.map((s) => ({
      itemId: s.itemId,
      price: Number(s.price),
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

  // Never hide a field that already holds a value — the batch would submit
  // a number nobody on screen can see.
  const extrasInUse =
    EXTRA_COLUMNS.some((col) => applyAll[col.key] !== '') ||
    staged.some((item) => EXTRA_COLUMNS.some((col) => item[col.key] !== ''))
  const showExtras = showExtraFields || extrasInUse
  const columns = showExtras ? FIELD_COLUMNS : CORE_COLUMNS

  return (
    // The purple card chrome lives on the collapsible wrapper in
    // PriceListDetailPageView now — this is just its body.
    <div className="space-y-4 p-4">
      <div className="relative">
        <label htmlFor="add-items-search" className="mb-1 block text-xs font-medium text-[#5b5b6b]">
          Search items to add
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8b9b]" />
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
            className="w-full rounded-lg border border-[#e4e4e9] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#5b21b6] focus:ring-1 focus:ring-[#5b21b6]"
          />
        </div>
        {showResults && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#e4e4e9] bg-white shadow-lg">
            {isSearching ? (
              <div className="flex items-center justify-center py-4 text-[#8b8b9b]">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : visibleResults.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[#8b8b9b]">No items found</div>
            ) : (
              visibleResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => stageItem(item)}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-[#f1ebfb]"
                >
                  <span className="font-medium text-[#3d3d4a]">{item.name}</span>
                  <span className="text-xs text-[#8b8b9b]">{item.sku}</span>
                </button>
              ))
            )}
          </div>
        )}
        {showResults && (
          <button
            type="button"
            onClick={() => setShowResults(false)}
            className="absolute right-2 top-8 rounded p-1 text-[#8b8b9b] hover:bg-[#f1f1f4]"
            title="Close search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {staged.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#5b5b6b]">
              {staged.length} item{staged.length === 1 ? '' : 's'} staged — price is required on
              each.
            </p>
            <button
              type="button"
              onClick={() => setShowExtraFields((open) => !open)}
              disabled={extrasInUse && showExtraFields}
              title={
                extrasInUse && showExtraFields
                  ? 'Clear the values in these fields to hide them again'
                  : undefined
              }
              className="rounded-lg px-2 py-1 text-xs font-medium text-[#3f1490] hover:bg-[#f0e9fc] disabled:opacity-40"
            >
              {showExtras ? 'Fewer fields' : 'More fields'}
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#e4e4e9] bg-white">
            <table
              className={`w-full table-fixed text-sm ${showExtras ? 'min-w-[62rem]' : 'min-w-[42rem]'}`}
            >
              <colgroup>
                <col className={showExtras ? 'w-[25%]' : 'w-[34%]'} />
                {columns.map((col) => (
                  <col key={col.key} className={showExtras ? 'w-[11%]' : 'w-[19%]'} />
                ))}
                <col className="w-[9%]" />
              </colgroup>
              <thead
                className={`bg-[#fbfbfc] text-left ${MONO} text-[10px] font-semibold uppercase tracking-[0.09em] text-[#5b5b6b]`}
              >
                <tr>
                  <th className="px-3 py-2">Item</th>
                  {columns.map((col) => (
                    <th key={col.key} className="px-3 py-2 text-right">
                      {col.label}
                      {col.required && <span className="text-[#b42318]"> *</span>}
                    </th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eeeef1]">
                {/* Fill in whatever should be the same everywhere, then one
                    press copies it into every staged row below. */}
                <tr className="bg-[#fbfbfc]">
                  <td className="px-3 py-2">
                    <p className="text-xs font-medium text-[#3d3d4a]">Apply to all</p>
                    <p className="text-[11px] leading-snug text-[#8b8b9b]">Fills every row below</p>
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step={col.step ?? '0.01'}
                        value={applyAll[col.key]}
                        onChange={(e) => setApplyAll((a) => ({ ...a, [col.key]: e.target.value }))}
                        placeholder="0.00"
                        aria-label={`${col.label} for all staged items`}
                        className={fieldInputClass}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={applyAllToRows}
                      disabled={filledForAll.length === 0}
                      title={
                        filledForAll.length === 0
                          ? 'Type a value above first'
                          : `Copy ${filledForAll.map((c) => c.label).join(', ')} into every staged row`
                      }
                      className="rounded-lg border border-[#ddd0f7] px-2.5 py-1.5 text-xs font-medium text-[#3f1490] hover:bg-[#f0e9fc] disabled:opacity-40"
                    >
                      Apply
                    </button>
                  </td>
                </tr>

                {staged.map((item) => (
                  <tr key={item.itemId} className="align-top hover:bg-[#fbfbfc]">
                    <td className="px-3 py-2.5">
                      {/* Catalog names run long — two lines, then the full
                          name stays reachable on hover. */}
                      <p
                        title={item.name}
                        className="line-clamp-2 font-medium leading-snug text-[#17171c]"
                      >
                        {item.name}
                      </p>
                      <p className={`${MONO} mt-0.5 text-[10.5px] text-[#8b8b9b]`}>{item.sku}</p>
                    </td>
                    {columns.map((col) => (
                      <td key={col.key} className="px-3 py-2.5">
                        <input
                          aria-label={`${col.label} for ${item.name}`}
                          type="number"
                          min="0"
                          step={col.step ?? '0.01'}
                          value={item[col.key]}
                          onChange={(e) => updateStagedField(item.itemId, col.key, e.target.value)}
                          placeholder="0.00"
                          className={fieldInputClass}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => unstageItem(item.itemId)}
                        aria-label={`Remove ${item.name} from batch`}
                        title="Remove from batch"
                        className="rounded-lg p-1.5 text-[#8b8b9b] hover:bg-[#fdeceb] hover:text-[#b42318]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setStaged([])}
              className="rounded-lg px-2 py-1 text-xs font-medium text-[#5b5b6b] hover:bg-[#f1f1f4] hover:text-[#17171c]"
            >
              Clear batch
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isAdding}
              className="flex items-center gap-1.5 rounded-lg bg-[#5b21b6] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a189b] disabled:opacity-60"
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
