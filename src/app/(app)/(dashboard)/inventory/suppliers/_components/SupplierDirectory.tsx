'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, ChevronRight, Loader2 } from 'lucide-react'
import { STALE } from '@/src/libs/query/stale-times'
import { getSuppliers } from '../../purchase-orders/_actions/get-suppliers'
import { getItems } from '../../items/_actions/get-items'
import SupplierItemsPanel from './SupplierItemsPanel'
import type { SessionUser } from '@/src/libs/guards/permission'
import { hasPermission } from '@/src/hooks/usePermission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'

type SupplierOption = { id: string; code: string; name: string; taxId?: string | null }

export default function SupplierDirectory({ session }: { session: SessionUser }) {
  const canUpdate = hasPermission(session, PROCUREMENT_PERMISSIONS.SUPPLIERS_UPDATE)

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<SupplierOption | null>(null)

  const suppliersQuery = useQuery({
    queryKey: ['suppliers-directory', search],
    queryFn: () => getSuppliers({ search: search || undefined, limit: 100 }),
    staleTime: STALE.OPERATIONAL,
  })

  const itemsQuery = useQuery({
    queryKey: ['inventory-items-lookup-active'],
    queryFn: () => getItems({ limit: 500, lifecycle: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const suppliers = suppliersQuery.data?.data?.data ?? []
  const itemOptions = (itemsQuery.data?.data?.data ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    sku: i.sku,
  }))

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Suppliers</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Select a supplier to manage which items they carry.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Supplier list */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setSelected(null)
                }}
                placeholder="Search suppliers…"
                className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setSelected(null)
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {suppliersQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : suppliers.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-400">No suppliers found.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
                {suppliers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelected(s)}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 transition-colors ${
                      selected?.id === s.id
                        ? 'bg-prominent-purple-50 border-l-2 border-prominent-purple-600'
                        : ''
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{s.name}</p>
                      <p className="text-xs text-zinc-400">{s.code}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-300 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items panel */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            {!selected ? (
              <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-zinc-400">
                Select a supplier on the left to view and manage their items.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">{selected.name}</h2>
                  <p className="text-xs text-zinc-400">{selected.code}</p>
                </div>
                <hr className="border-zinc-100" />
                <SupplierItemsPanel
                  key={selected.id}
                  supplierId={selected.id}
                  itemOptions={itemOptions}
                  canUpdate={canUpdate}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
