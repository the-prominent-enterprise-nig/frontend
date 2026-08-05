'use client'

import { useMemo, useState } from 'react'
import { Plus, RefreshCw, Search, Tag, Pencil, Trash2 } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useBrands } from '../_hooks/useBrands'
import BrandModal from './BrandModal'
import type {
  ItemClassification,
  ItemClassificationFormValues,
} from '@/src/schema/inventory/classification'
import { formatClassificationLabel } from '@/src/libs/format/text'

export default function BrandsPageView({ session }: { session: SessionUser }) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.ITEMS_MANAGE_CLASSIFICATION)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ItemClassification | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ItemClassification | null>(null)
  const [search, setSearch] = useState('')

  const {
    brands,
    isLoading,
    isFetching,
    error,
    refetch,
    createBrand,
    isCreating,
    updateBrand,
    isUpdating,
    deleteBrand,
    isDeleting,
  } = useBrands()

  const filteredBrands = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return brands
    return brands.filter(
      (brand) =>
        formatClassificationLabel(brand.name).toLowerCase().includes(query) ||
        (brand.description ?? '').toLowerCase().includes(query)
    )
  }, [brands, search])

  function openCreate() {
    setEditTarget(null)
    setIsModalOpen(true)
  }

  function openEdit(brand: ItemClassification) {
    setEditTarget(brand)
    setIsModalOpen(true)
  }

  async function handleSubmit(data: ItemClassificationFormValues) {
    if (editTarget) return updateBrand(editTarget.id, data)
    return createBrand(data)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await deleteBrand(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Brands</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage the brand catalog used to classify inventory items.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {canManage && (
              <button
                type="button"
                onClick={openCreate}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <Plus className="h-4 w-4" />
                New Brand
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brands…"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load brands</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div className="p-8 text-center text-sm text-zinc-400">Loading brands…</div>
          ) : filteredBrands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Tag className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">
                {brands.length === 0 ? 'No brands yet' : 'No brands match your search'}
              </p>
              {canManage && brands.length === 0 && (
                <p className="mt-1 text-xs text-zinc-400">
                  Add a brand to start classifying items.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Description
                    </th>
                    {canManage && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredBrands.map((brand) => (
                    <tr key={brand.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">
                          {formatClassificationLabel(brand.name)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{brand.description ?? '—'}</td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(brand)}
                              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-prominent-purple-700"
                              title="Edit brand"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(brand)}
                              className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                              title="Delete brand"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <BrandModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
        editTarget={editTarget}
      />

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Delete Brand</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Are you sure you want to delete{' '}
              <span className="font-medium text-zinc-800">
                {formatClassificationLabel(deleteTarget.name)}
              </span>
              ? Brands still assigned to items cannot be deleted.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
