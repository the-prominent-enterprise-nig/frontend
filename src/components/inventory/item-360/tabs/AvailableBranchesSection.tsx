'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, MapPin, Search } from 'lucide-react'
import { getItemStockSummary } from '@/src/app/(app)/(dashboard)/inventory/stock/_actions/get-item-stock-summary'
import type { StockBalance } from '@/src/schema/inventory/goods-receiving'
import { STALE } from '@/src/libs/query/stale-times'

export default function AvailableBranchesSection({ itemId }: { itemId: string }) {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-item-360', itemId, 'stock-availability'],
    queryFn: () => getItemStockSummary(itemId),
    staleTime: STALE.OPERATIONAL,
    enabled: !!itemId,
  })

  const raw = data?.success
    ? (data.data as unknown as { data?: StockBalance[] } | undefined)
    : undefined
  const balances = raw?.data ?? []
  const available = balances
    .filter((b) => Number(b.availableQty ?? 0) > 0)
    .map((balance) => ({
      balance,
      label:
        balance.warehouse?.branch?.name ??
        balance.warehouse?.name ??
        balance.warehouse?.code ??
        '—',
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const filtered = search.trim()
    ? available.filter((a) => a.label.toLowerCase().includes(search.trim().toLowerCase()))
    : available

  return (
    <div>
      <div className="mb-3 space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <MapPin className="h-3.5 w-3.5" />
          Available At
        </p>
        {available.length > 0 && (
          <div className="relative w-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search branch…"
              className="w-48 rounded-lg border border-zinc-200 py-1.5 pl-8 pr-2.5 text-xs outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
            />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-zinc-200 py-6 text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : available.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 py-5 text-center text-sm text-zinc-400">
          Not currently in stock at any branch.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 py-5 text-center text-sm text-zinc-400">
          No branches match &ldquo;{search.trim()}&rdquo;.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filtered.map(({ balance, label }) => (
            <span
              key={balance.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700"
            >
              {label}
              <span className="text-green-500">
                · {Number(balance.availableQty ?? 0).toLocaleString()}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
