'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, RefreshCw, Tags, Pencil, Trash2 } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import Drawer from '@/src/components/ui/drawer/Drawer'
import { usePriceUseTypes } from '../../price-use-types/_hooks/usePriceUseTypes'
import PriceUseTypeModal from '../../price-use-types/_components/PriceUseTypeModal'
import type { PriceUseType, PriceUseTypeFormValues } from '@/src/schema/inventory/price-use-types'

type Props = {
  isOpen: boolean
  onClose: () => void
  session: SessionUser
}

export default function ManageCategoriesDrawer({ isOpen, onClose, session }: Props) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.PRICE_LISTS_MANAGE_PRICE_USE_TYPES)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<PriceUseType | undefined>(undefined)
  const [deletingType, setDeletingType] = useState<PriceUseType | null>(null)

  const {
    priceUseTypes,
    isLoading,
    isFetching,
    error,
    createPriceUseType,
    isCreating,
    updatePriceUseType,
    isUpdating,
    deletePriceUseType,
    isDeleting,
    refetch,
  } = usePriceUseTypes()

  function openCreateModal() {
    setEditingType(undefined)
    setIsModalOpen(true)
  }

  function openEditModal(type: PriceUseType) {
    setEditingType(type)
    setIsModalOpen(true)
  }

  async function handleSubmit(data: PriceUseTypeFormValues) {
    return editingType ? updatePriceUseType({ id: editingType.id, data }) : createPriceUseType(data)
  }

  async function handleDelete() {
    if (!deletingType) return
    await deletePriceUseType(deletingType.id)
    setDeletingType(null)
  }

  async function handleToggleActive(type: PriceUseType) {
    await updatePriceUseType({ id: type.id, data: { isActive: !type.isActive } })
  }

  return (
    <>
      <Drawer isOpen={isOpen} onClose={onClose} title="Price Use Types" width="md">
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              The categories price lists are grouped under — add, rename, or retire your own.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
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
                onClick={openCreateModal}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <Plus className="h-4 w-4" />
                New Price Use Type
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">Failed to load price use types</p>
            </div>
          )}

          <div
            className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
          >
            {isLoading ? (
              <div className="p-8 text-center text-sm text-zinc-400">Loading price use types…</div>
            ) : priceUseTypes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Tags className="mb-3 h-10 w-10 text-zinc-300" />
                <p className="text-sm font-medium text-zinc-500">No price use types yet</p>
                {canManage && (
                  <p className="mt-1 text-xs text-zinc-400">
                    Create one to start categorizing price lists, e.g. WIP, CR-BR, SSC.
                  </p>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    {canManage && (
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {priceUseTypes.map((type) => (
                    <tr
                      key={type.id}
                      className={`hover:bg-zinc-50 ${type.isActive ? '' : 'opacity-60'}`}
                    >
                      <td className="px-4 py-3 font-medium text-zinc-900">{type.name}</td>
                      <td className="px-4 py-3 text-zinc-600">{type.description || '—'}</td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={type.isActive}
                            title={
                              type.isActive
                                ? 'Active — visible in POS checkout'
                                : 'Inactive — hidden from POS checkout'
                            }
                            onClick={() => handleToggleActive(type)}
                            disabled={isUpdating}
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${type.isActive ? 'bg-prominent-orange-500' : 'bg-gray-200'}`}
                          >
                            <span
                              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${type.isActive ? 'translate-x-4' : 'translate-x-0'}`}
                            />
                          </button>
                        ) : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${type.isActive ? 'bg-green-50 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}
                          >
                            {type.isActive ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              title="Edit"
                              onClick={() => openEditModal(type)}
                              className="rounded-lg p-1.5 text-prominent-purple-700 hover:bg-prominent-purple-50"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Delete"
                              onClick={() => setDeletingType(type)}
                              className="rounded-lg p-1.5 text-red-700 hover:bg-red-50"
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
            )}
          </div>
        </div>
      </Drawer>

      <PriceUseTypeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={editingType ? isUpdating : isCreating}
        initial={editingType}
      />

      {deletingType &&
        createPortal(
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-zinc-900">Delete price use type?</h2>
              <p className="mt-2 text-sm text-zinc-500">
                This removes <strong>{deletingType.name}</strong>. Price lists still using it must
                be reassigned first.
              </p>
              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingType(null)}
                  disabled={isDeleting}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
