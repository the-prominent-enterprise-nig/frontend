'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { RefreshCw, Search, Tag, X } from 'lucide-react'
import { StockStatusBadge } from '@/src/components/inventory/StockStatusBadge'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { can, type SessionUser } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { usePosCatalog, type PosCatalogItem } from '../_hooks/usePosCatalog'
import { PriceTierModal } from './PriceTierModal'

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
})

function matchesSearch(item: PosCatalogItem, term: string): boolean {
  if (!term) return true
  const haystack = [item.name, item.sku, item.brand?.name, item.modelNumber, item.category?.name]
  return haystack.some((v) => v?.toLowerCase().includes(term))
}

function uniqueCategories(items: PosCatalogItem[]): CategorySelectOption[] {
  const seen = new Map<string, string>()
  for (const item of items) if (item.category) seen.set(item.category.id, item.category.name)
  return [...seen]
    .map(([id, name]) => ({ id, name, depth: 0 }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function ProductCatalog({
  session,
  branchId,
  branchName,
}: {
  session: SessionUser
  branchId: string | null
  branchName: string | null
}) {
  const { data: items, isLoading, isFetching, error, refetch } = usePosCatalog(branchId)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [tierItem, setTierItem] = useState<PosCatalogItem | null>(null)

  const canViewStock = can(session, INVENTORY_PERMISSIONS.STOCKS_READ)
  const all = useMemo(() => items ?? [], [items])
  const categories = useMemo(() => uniqueCategories(all), [all])
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return all.filter(
      (item) => (!categoryId || item.category?.id === categoryId) && matchesSearch(item, term)
    )
  }, [all, search, categoryId])

  const filtered = search !== '' || categoryId !== ''

  return (
    <div className="min-h-full bg-zinc-50 p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[21px] font-semibold tracking-[-0.015em]">Product Catalog</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Browse brands, models, prices and stock. Stock and prices are for{' '}
              {branchName ?? 'your branch'}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, brand, model, category or SKU…"
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-8 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <CategorySelect
            value={categoryId || undefined}
            onChange={(id) => setCategoryId(id ?? '')}
            options={categories}
            placeholder="All Categories"
            aria-label="Category"
            className="min-w-[180px]"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load the catalog</p>
            <p className="mt-1 text-xs text-red-600">Please try refreshing the page.</p>
          </div>
        )}

        <CatalogTable
          items={visible}
          isLoading={isLoading}
          filtered={filtered}
          canViewStock={canViewStock}
          onViewTiers={setTierItem}
        />
      </div>

      <PriceTierModal item={tierItem} onClose={() => setTierItem(null)} />
    </div>
  )
}

function CatalogTable({
  items,
  isLoading,
  filtered,
  canViewStock,
  onViewTiers,
}: {
  items: PosCatalogItem[]
  isLoading: boolean
  filtered: boolean
  canViewStock: boolean
  onViewTiers: (item: PosCatalogItem) => void
}) {
  return (
    <div className="scroll-fade-x overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full min-w-[860px] text-sm">
        <thead className="bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-2.5">Item</th>
            <th className="px-4 py-2.5">Category</th>
            <th className="px-4 py-2.5">Brand / Model</th>
            <th className="px-4 py-2.5 text-right">Price</th>
            <th className="px-4 py-2.5">Stock</th>
            <th className="px-4 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {isLoading ? (
            <SkeletonRows />
          ) : items.length === 0 ? (
            <EmptyRow filtered={filtered} />
          ) : (
            items.map((item) => (
              <CatalogRow
                key={item.id}
                item={item}
                canViewStock={canViewStock}
                onViewTiers={onViewTiers}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function CatalogRow({
  item,
  canViewStock,
  onViewTiers,
}: {
  item: PosCatalogItem
  canViewStock: boolean
  onViewTiers: (item: PosCatalogItem) => void
}) {
  return (
    <tr className="align-top hover:bg-zinc-50/60">
      <td className="px-4 py-3">
        <div className="flex items-start gap-3">
          <ItemThumb item={item} />
          <div className="min-w-0">
            <div className="font-semibold text-zinc-900">{item.name}</div>
            {item.sku && <div className="font-mono text-xs text-zinc-400">{item.sku}</div>}
            {item.description && (
              <div className="mt-0.5 max-w-xs text-xs text-zinc-500">{item.description}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-zinc-600">{item.category?.name ?? '—'}</td>
      <td className="px-4 py-3 text-zinc-600">
        {[item.brand?.name, item.modelNumber].filter(Boolean).join(' — ') || '—'}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-zinc-900">
        {peso.format(item.price)}
      </td>
      <td className="px-4 py-3">
        <StockCell item={item} canViewStock={canViewStock} />
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onViewTiers(item)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-prominent-purple-300 bg-white px-3 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
        >
          <Tag className="h-3.5 w-3.5" />
          View Price Tiers
        </button>
      </td>
    </tr>
  )
}

function StockCell({ item, canViewStock }: { item: PosCatalogItem; canViewStock: boolean }) {
  const qty = item.stockQty ?? 0
  return (
    <div className="flex flex-col items-start gap-1">
      <StockStatusBadge status={qty > 0 ? 'in_stock' : 'out'} size="sm" />
      {canViewStock ? (
        <Link href="/inventory/stock" className="text-xs text-prominent-purple-700 hover:underline">
          {qty} units
        </Link>
      ) : (
        <span className="text-xs text-zinc-500">{qty} units</span>
      )}
    </div>
  )
}

function ItemThumb({ item }: { item: PosCatalogItem }) {
  if (!item.imageUrl) {
    return <div className="h-12 w-12 shrink-0 rounded-lg bg-zinc-100" aria-hidden />
  }
  return (
    <Image
      src={item.imageUrl}
      alt=""
      width={48}
      height={48}
      unoptimized
      className="h-12 w-12 shrink-0 rounded-lg border border-zinc-200 object-cover"
    />
  )
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <tr key={i}>
          <td colSpan={6} className="px-4 py-3">
            <Skeleton className="h-10 w-full" />
          </td>
        </tr>
      ))}
    </>
  )
}

function EmptyRow({ filtered }: { filtered: boolean }) {
  return (
    <tr>
      <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-400">
        {filtered ? 'No items match your search.' : 'No sellable items yet.'}
      </td>
    </tr>
  )
}
