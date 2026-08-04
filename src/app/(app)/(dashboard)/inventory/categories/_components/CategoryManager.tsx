'use client'

import { useState } from 'react'
import { Plus, RefreshCw, AlertCircle, Tags } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { useCategoryManager } from '../_hooks/useCategoryManager'
import CategoryTree from './CategoryTree'
import CategoryFormModal from './CategoryFormModal'
import type { CategoryNode } from '@/src/schema/inventory/categories'

interface SessionUser {
  id: string
  employeeId?: string
  roles: string[]
  permissions: string[]
}

export default function CategoryManager({ session }: { session: SessionUser | null }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.CATEGORIES_CREATE)
  const canUpdate = hasPermission(session, INVENTORY_PERMISSIONS.CATEGORIES_UPDATE)
  const canDelete = hasPermission(session, INVENTORY_PERMISSIONS.CATEGORIES_DELETE)

  const {
    tree,
    flatCategories,
    isLoading,
    isFetching,
    error,
    statusFilter,
    setStatusFilter,
    editingNode,
    setEditingNode,
    parentForNew,
    showCreateModal,
    setShowCreateModal,
    openCreateChild,
    deleteTarget,
    setDeleteTarget,
    createCategory,
    isCreating,
    updateCategory,
    isUpdating,
    deleteCategory,
    isDeleting,
  } = useCategoryManager()

  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  function handleAddChild(parent: CategoryNode) {
    if (!canCreate) return
    openCreateChild(parent)
  }

  function handleEdit(node: CategoryNode) {
    if (!canUpdate) return
    setEditingNode(node)
  }

  function handleDelete(node: CategoryNode) {
    if (!canDelete) return
    setDeleteTarget(node)
    setDeleteConfirmText('')
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Category Management</h1>
          <p className="text-sm text-zinc-500">
            Organize items into a nested hierarchy for easy navigation and reporting.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter ?? ''}
            onChange={(e) =>
              setStatusFilter((e.target.value || undefined) as 'active' | 'inactive' | undefined)
            }
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none focus:border-prominent-purple-500"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {canCreate && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Tags className="h-4 w-4" />
            <span>Category hierarchy</span>
            {isFetching && !isLoading && (
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-zinc-400" />
            )}
          </div>
        </div>

        <div className="px-2 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-zinc-400">
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Loading categories…
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              Failed to load categories. Please try again.
            </div>
          ) : tree.length === 0 ? (
            <div className="py-12 text-center">
              <Tags className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No categories yet</p>
              {canCreate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Click "Add Category" to create your first one.
                </p>
              )}
            </div>
          ) : (
            <CategoryTree
              nodes={tree}
              canCreate={canCreate}
              canUpdate={canUpdate}
              canDelete={canDelete}
              onAddChild={handleAddChild}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>

      {/* Create modal */}
      <CategoryFormModal
        mode="create"
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={createCategory}
        isSubmitting={isCreating}
        parentPreset={parentForNew}
        flatCategories={flatCategories}
      />

      {/* Edit modal */}
      {editingNode && (
        <CategoryFormModal
          mode="edit"
          isOpen={!!editingNode}
          onClose={() => setEditingNode(null)}
          onSubmit={(data) => updateCategory(editingNode.id, data)}
          isSubmitting={isUpdating}
          node={editingNode}
          flatCategories={flatCategories}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Delete category?</h3>
            <p className="mt-2 text-sm text-zinc-600">
              This will permanently delete{' '}
              <span className="font-medium text-zinc-900">"{deleteTarget.name}"</span>. This action
              cannot be undone. Categories with sub-categories or assigned items cannot be deleted.
            </p>

            <p className="mt-4 text-xs text-zinc-500">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400"
            />

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                onClick={() => deleteCategory(deleteTarget.id)}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
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
