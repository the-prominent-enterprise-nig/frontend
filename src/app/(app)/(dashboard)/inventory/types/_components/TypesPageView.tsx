'use client'

import { useMemo, useState } from 'react'
import { Plus, RefreshCw, Search, Shapes, Pencil, Trash2 } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useItemTypes } from '../_hooks/useItemTypes'
import TypeModal from './TypeModal'
import type {
  ItemClassification,
  ItemClassificationFormValues,
} from '@/src/schema/inventory/classification'
import { formatClassificationLabel } from '@/src/libs/format/text'

export default function TypesPageView({ session }: { session: SessionUser }) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.ITEMS_MANAGE_CLASSIFICATION)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ItemClassification | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ItemClassification | null>(null)
  const [search, setSearch] = useState('')

  const {
    types,
    isLoading,
    isFetching,
    error,
    refetch,
    createType,
    isCreating,
    updateType,
    isUpdating,
    deleteType,
    isDeleting,
  } = useItemTypes()

  const filteredTypes = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return types
    return types.filter(
      (type) =>
        formatClassificationLabel(type.name).toLowerCase().includes(query) ||
        (type.description ?? '').toLowerCase().includes(query)
    )
  }, [types, search])

  function openCreate() {
    setEditTarget(null)
    setIsModalOpen(true)
  }

  function openEdit(type: ItemClassification) {
    setEditTarget(type)
    setIsModalOpen(true)
  }

  async function handleSubmit(data: ItemClassificationFormValues) {
    if (editTarget) return updateType(editTarget.id, data)
    return createType(data)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await deleteType(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Types</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Manage the item types used to classify inventory items.
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
                New Type
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
            placeholder="Search types…"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load types</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div className="p-8 text-center text-sm text-zinc-400">Loading types…</div>
          ) : filteredTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Shapes className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">
                {types.length === 0 ? 'No types yet' : 'No types match your search'}
              </p>
              {canManage && types.length === 0 && (
                <p className="mt-1 text-xs text-zinc-400">Add a type to start classifying items.</p>
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
                  {filteredTypes.map((type) => (
                    <tr key={type.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">
                          {formatClassificationLabel(type.name)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{type.description ?? '—'}</td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(type)}
                              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-prominent-purple-700"
                              title="Edit type"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(type)}
                              className="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                              title="Delete type"
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

      <TypeModal
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
            <h3 className="text-base font-semibold text-zinc-900">Delete Type</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Are you sure you want to delete{' '}
              <span className="font-medium text-zinc-800">
                {formatClassificationLabel(deleteTarget.name)}
              </span>
              ? Types still assigned to items cannot be deleted.
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
