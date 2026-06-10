'use client'

import { useState } from 'react'
import { Plus, RefreshCw, Sliders } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useAttributes } from '../_hooks/useAttributes'
import AttributeModal from './AttributeModal'
import type {
  AttributeDefinition,
  AttributeDefinitionFormValues,
} from '@/src/schema/inventory/attributes'

function dataTypeBadge(type: string) {
  const map: Record<string, string> = {
    text: 'bg-blue-100 text-blue-700',
    number: 'bg-green-100 text-green-700',
    boolean: 'bg-purple-100 text-purple-700',
    date: 'bg-amber-100 text-amber-700',
    dropdown: 'bg-teal-100 text-teal-700',
    multi_select: 'bg-pink-100 text-pink-700',
  }
  return map[type] ?? 'bg-zinc-100 text-zinc-500'
}

export default function AttributesPageView({ session }: { session: SessionUser }) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.ATTRIBUTES_MANAGE)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AttributeDefinition | null>(null)

  const {
    attributes,
    pagination,
    isLoading,
    isFetching,
    error,
    page,
    setPage,
    categoryOptions,
    createAttribute,
    isCreating,
    updateAttribute,
    isUpdating,
    refetch,
  } = useAttributes()

  function openCreate() {
    setEditTarget(null)
    setIsModalOpen(true)
  }

  function openEdit(attr: AttributeDefinition) {
    setEditTarget(attr)
    setIsModalOpen(true)
  }

  async function handleSubmit(data: AttributeDefinitionFormValues) {
    if (editTarget) return updateAttribute(editTarget.id, data)
    return createAttribute(data)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Item Attributes</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Create and manage custom attributes for inventory items.
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
                New Attribute
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load attributes</p>
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div className="p-8 text-center text-sm text-zinc-400">Loading attributes…</div>
          ) : attributes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Sliders className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No attribute definitions yet</p>
              {canManage && (
                <p className="mt-1 text-xs text-zinc-400">
                  Add custom attributes to extend item data.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Display Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Key
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Data Type
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Required
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Order
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden lg:table-cell">
                      Status
                    </th>
                    {canManage && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {attributes.map((attr) => (
                    <tr key={attr.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{attr.displayName}</p>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                          {attr.attributeKey}
                        </code>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${dataTypeBadge(attr.dataType)}`}
                        >
                          {attr.dataType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3 text-center md:table-cell">
                        {attr.isRequired ? (
                          <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-600">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
                            No
                          </span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-center text-zinc-600 lg:table-cell">
                        {attr.displayOrder}
                      </td>
                      <td className="hidden px-4 py-3 text-zinc-600 lg:table-cell capitalize">
                        {attr.status ?? '—'}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEdit(attr)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3 text-sm text-zinc-500">
              <span>
                Page {page} of {pagination.totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                  disabled={page >= pagination.totalPages}
                  className="rounded-lg px-3 py-1.5 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AttributeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
        categories={categoryOptions}
        editTarget={editTarget}
      />
    </div>
  )
}
