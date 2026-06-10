'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, Plus, Loader2, PackageX, Search } from 'lucide-react'
import {
  addSubstitute,
  removeSubstitute,
} from '@/src/app/(app)/(dashboard)/inventory/items/_actions/substitutes'
import { getItems } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-items'
import type { ItemSubstitute, ItemSummary, ItemListResponse } from '@/src/schema/inventory/items'

const LIFECYCLE_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  discontinued: 'bg-orange-100 text-orange-700',
  archived: 'bg-zinc-100 text-zinc-500',
}

type SelectedItem = { id: string; name: string; sku: string }

type Props = {
  itemId: string
  substitutes: ItemSubstitute[]
  isLoading: boolean
}

function ItemSearchCombobox({
  value,
  onChange,
  excludeIds,
}: {
  value: SelectedItem | null
  onChange: (item: SelectedItem | null) => void
  excludeIds: string[]
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data, isFetching } = useQuery({
    queryKey: ['item-search-substitutes', search],
    queryFn: () => getItems({ search, limit: 10, lifecycle: 'active' }),
    enabled: search.length >= 1,
    staleTime: 30_000,
  })

  const results = (data?.success ? ((data.data as ItemListResponse)?.data ?? []) : []).filter(
    (item) => !excludeIds.includes(item.id)
  )

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  function handleSelect(item: ItemSummary) {
    onChange({ id: item.id, name: item.name, sku: item.sku })
    setSearch('')
    setOpen(false)
  }

  function handleClear() {
    onChange(null)
    setSearch('')
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-prominent-purple-300 bg-prominent-purple-50 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-800">{value.name}</p>
          <p className="font-mono text-xs text-zinc-400">{value.sku}</p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 focus-within:border-prominent-purple-500 focus-within:ring-1 focus-within:ring-prominent-purple-500">
        <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <input
          type="text"
          placeholder="Search item by name or SKU…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
        />
        {isFetching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zinc-400" />}
      </div>

      {open && search.length >= 1 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {results.length === 0 && !isFetching ? (
            <p className="px-3 py-3 text-center text-xs text-zinc-400">No items found</p>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-800">{item.name}</p>
                  <p className="font-mono text-xs text-zinc-400">{item.sku}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function SubstitutesTab({ itemId, substitutes, isLoading }: Props) {
  const queryClient = useQueryClient()
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null)
  const [note, setNote] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const removeMutation = useMutation({
    mutationFn: (subItemId: string) => removeSubstitute(itemId, subItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['inventory-item-360', itemId, 'substitutes'],
      })
    },
  })

  const addMutation = useMutation({
    mutationFn: () => addSubstitute(itemId, selectedItem!.id, note.trim() || undefined),
    onSuccess: (result) => {
      if (!result.success) {
        setAddError(result.message ?? result.error ?? 'Failed to add substitute')
        return
      }
      setSelectedItem(null)
      setNote('')
      setAddError(null)
      queryClient.invalidateQueries({
        queryKey: ['inventory-item-360', itemId, 'substitutes'],
      })
    },
    onError: () => {
      setAddError('An unexpected error occurred')
    },
  })

  function handleAdd() {
    if (!selectedItem) {
      setAddError('Please select a substitute item')
      return
    }
    setAddError(null)
    addMutation.mutate()
  }

  const excludeIds = [itemId, ...substitutes.map((s) => s.substituteItemId)]

  if (isLoading) {
    return (
      <div className="divide-y divide-zinc-100">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-4">
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-100" />
            <div className="h-4 flex-1 animate-pulse rounded bg-zinc-100" />
            <div className="h-4 w-16 animate-pulse rounded bg-zinc-100" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0">
      {/* List */}
      {substitutes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <PackageX className="mb-3 h-10 w-10 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-500">No substitutes yet</p>
          <p className="mt-1 text-xs text-zinc-400">
            Add substitute items that can replace this item.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {substitutes.map((sub) => {
            const lifecycle = sub.substituteItem.lifecycle ?? 'active'
            const price =
              sub.substituteItem.sellingPrice != null
                ? `₱${Number(sub.substituteItem.sellingPrice).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                : '—'

            return (
              <div key={sub.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-zinc-50">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-zinc-400">
                      {sub.substituteItem.sku}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${LIFECYCLE_COLORS[lifecycle]}`}
                    >
                      {lifecycle}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-zinc-800">
                    {sub.substituteItem.name}
                  </p>
                  {sub.note && <p className="mt-0.5 text-xs italic text-zinc-400">{sub.note}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-zinc-700">{price}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(sub.substituteItemId)}
                  disabled={removeMutation.isPending}
                  className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label="Remove substitute"
                >
                  {removeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Add form */}
      <div className="border-t border-zinc-200 px-5 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Add Substitute
        </p>
        <div className="flex flex-col gap-2">
          <ItemSearchCombobox
            value={selectedItem}
            onChange={setSelectedItem}
            excludeIds={excludeIds}
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
          />
          {addError && <p className="text-xs text-red-600">{addError}</p>}
          <button
            type="button"
            onClick={handleAdd}
            disabled={addMutation.isPending || !selectedItem}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
          >
            {addMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Substitute
          </button>
        </div>
      </div>
    </div>
  )
}
