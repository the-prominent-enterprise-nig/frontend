'use client'

import { useState } from 'react'
import { RefreshCw, Tags } from 'lucide-react'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { CONTROL_CHROME, PLEX } from '@/src/libs/design/plex'
import {
  EmptyState,
  ListHeader,
  LoadError,
  PAGE_INNER,
  PAGE_SHELL,
  PRIMARY_BUTTON,
  TABLE_HEAD_ROW,
  TableCard,
} from '../../master-data/_components/masterDataChrome'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { useCategoryManager } from '../_hooks/useCategoryManager'
import CategoryTree from './CategoryTree'
import CategoryFormModal from './CategoryFormModal'
import type { CategoryNode } from '@/src/schema/inventory/categories'
import { formatClassificationLabel } from '@/src/libs/format/text'

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

  const addButton = canCreate && (
    <button type="button" onClick={() => setShowCreateModal(true)} className={PRIMARY_BUTTON}>
      + Add Category
    </button>
  )

  return (
    <div className={`${PAGE_SHELL} ${PLEX}`}>
      <div className={PAGE_INNER}>
        <ListHeader
          title="Category Management"
          description="Organize items into a nested hierarchy for easy navigation and reporting."
          actions={addButton || undefined}
        />

        <div className="flex flex-wrap items-center gap-2">
          <SearchableSelect
            className="min-w-[170px]"
            value={statusFilter ?? ''}
            onChange={(v) => setStatusFilter((v || undefined) as 'active' | 'inactive' | undefined)}
            placeholder="All statuses"
            ariaLabel="Status"
            chrome={CONTROL_CHROME}
            clearable
            options={STATUS_OPTIONS}
          />
        </div>

        {error && <LoadError message="Failed to load categories — try refreshing the page." />}

        <TableCard fetching={isFetching && !isLoading}>
          <div className={`flex items-center gap-2 px-4 py-2.5 ${TABLE_HEAD_ROW}`}>
            <Tags className="h-3.5 w-3.5" />
            <span>Category hierarchy</span>
            {isFetching && !isLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-ink-muted">Loading categories…</div>
          ) : error ? null : tree.length === 0 ? (
            <EmptyState
              icon={<Tags className="h-10 w-10" />}
              title="No categories yet"
              hint={canCreate ? 'Add your first category to start organizing items.' : undefined}
              action={addButton || undefined}
            />
          ) : (
            <div className="px-2 py-1">
              <CategoryTree
                nodes={tree}
                canCreate={canCreate}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onAddChild={handleAddChild}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
          )}
        </TableCard>
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
              <span className="font-medium text-zinc-900">
                "{formatClassificationLabel(deleteTarget.name)}"
              </span>
              . This action cannot be undone. Categories with sub-categories or assigned items
              cannot be deleted.
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
