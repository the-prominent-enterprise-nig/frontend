'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, Check } from 'lucide-react'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'

const EMPTY_SERIALS: SerialNumberSummary[] = []

type Props = {
  warehouseId: string
  itemId: string
  itemName: string
  onConfirm: (serials: { id: string; serialNumber: string }[]) => void
  onCancel: () => void
}

// Every item for this client is serial-tracked, so adding N units means
// picking N specific physical serials up front — not typing a quantity.
// Search + multi-select once, confirm adds one line per picked serial.
export function SerialMultiPicker({ warehouseId, itemId, itemName, onConfirm, onCancel }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Map<string, string>>(new Map())

  const serialsQuery = useQuery({
    queryKey: ['inventory-serials-in-stock', warehouseId, itemId],
    queryFn: () => getSerialNumbers({ warehouseId, itemId, status: 'in_stock', limit: 500 }),
    staleTime: 30 * 1000,
  })
  const serials = serialsQuery.data?.data?.data ?? EMPTY_SERIALS

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return serials
    return serials.filter((s) => s.serialNumber.toLowerCase().includes(q))
  }, [serials, search])

  function toggle(id: string, serialNumber: string) {
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, serialNumber)
      return next
    })
  }

  return (
    <div className="rounded-lg border border-prominent-purple-200 bg-prominent-purple-50/40 p-3">
      <p className="mb-2 text-sm font-medium text-zinc-700">
        Pick specific units — <span className="text-zinc-500">{itemName}</span>
      </p>

      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search serial number…"
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-prominent-purple-500"
        />
      </div>

      <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white">
        {serialsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-zinc-400">
            {serials.length === 0
              ? 'No units in stock at this warehouse.'
              : 'No serial number matches your search.'}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {filtered.map((s) => {
              const isChecked = selected.has(s.id)
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => toggle(s.id, s.serialNumber)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-prominent-purple-50 ${
                      isChecked ? 'bg-prominent-purple-50' : ''
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        isChecked
                          ? 'border-prominent-purple-600 bg-prominent-purple-600 text-white'
                          : 'border-zinc-300'
                      }`}
                    >
                      {isChecked && <Check className="h-3 w-3" />}
                    </span>
                    <span className="font-mono text-zinc-700">{s.serialNumber}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          {selected.size} unit{selected.size === 1 ? '' : 's'} selected
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm(Array.from(selected, ([id, serialNumber]) => ({ id, serialNumber })))
            }
            disabled={selected.size === 0}
            className="rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-40"
          >
            Add {selected.size || ''} Unit{selected.size === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  )
}
