'use client'

import { useState } from 'react'
import { Plus, RefreshCw, Search, X, Layers, ImagePlus } from 'lucide-react'
import { useItemMaster } from '../_hooks/useItemMaster'
import CreateItemModal from './CreateItemModal'
import EditItemModal from './EditItemModal'
import ItemMasterTable from './ItemMasterTable'
import CreateBundleModal from '../../bundles/_components/CreateBundleModal'
import BundleDetailModal from '../../bundles/_components/BundleDetailModal'
import VariantsModal from './VariantsModal'
import BulkImageImportModal from './BulkImageImportModal'
import type { ItemSummary, UpdateItemFormValues } from '@/src/schema/inventory/items'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import CategorySelect from '@/src/components/ui/CategorySelect'

export default function ItemMasterList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.ITEMS_CREATE)
  const canUpdate = hasPermission(session, INVENTORY_PERMISSIONS.ITEMS_UPDATE)
  const canDelete = hasPermission(session, INVENTORY_PERMISSIONS.ITEMS_DELETE)
  const canCreateBundle = hasPermission(session, INVENTORY_PERMISSIONS.BUNDLES_CREATE)

  const {
    items,
    pagination,
    categories,
    uomOptions,
    groupOptions,
    subgroupOptions,
    brandOptions,
    typeOptions,
    isLoading,
    isFetching,
    error,
    search,
    setSearch,
    lifecycle,
    setLifecycle,
    primaryCategoryId,
    setPrimaryCategoryId,
    resetFilters,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    page,
    setPage,
    createItem,
    isCreating,
    updateItem,
    isUpdating,
    updateItemAttributes,
    isUpdatingAttributes,
    updateLifecycle,
    deleteItem,
    refetch,
    selectedBundleItem,
    setSelectedBundleItem,
    bundleComponents,
    bundleAvailableQty,
    isLoadingComponents,
    itemOptions,
    createBundle,
    isCreatingBundle,
    addBundleComponent,
    isAddingBundleComponent,
    removeBundleComponent,
    removingComponentId,
    selectedVariantItem,
    setSelectedVariantItem,
    variants,
    isLoadingVariants,
    createVariant,
    isCreatingVariant,
  } = useItemMaster()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isBundleCreateOpen, setIsBundleCreateOpen] = useState(false)
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ItemSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ItemSummary | null>(null)

  function handleDelete(item: ItemSummary) {
    setDeleteTarget(item)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await deleteItem(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Item Master</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Create and manage product records across the system.
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
            {canCreateBundle && (
              <button
                type="button"
                onClick={() => setIsBundleCreateOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-prominent-purple-300 bg-white px-4 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
              >
                <Layers className="h-4 w-4" />
                New Bundle
              </button>
            )}
            {canUpdate && (
              <button
                type="button"
                onClick={() => setIsBulkImportOpen(true)}
                className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <ImagePlus className="h-4 w-4" />
                <span className="hidden sm:inline">Bulk Import Images</span>
                <span className="sm:hidden">Images</span>
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
            />
          </div>
          <select
            value={lifecycle ?? ''}
            onChange={(e) => setLifecycle((e.target.value || undefined) as typeof lifecycle)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="discontinued">Discontinued</option>
            <option value="archived">Archived</option>
          </select>
          {categories.length > 0 && (
            <CategorySelect
              value={primaryCategoryId}
              onChange={setPrimaryCategoryId}
              options={categories}
              placeholder="All Categories"
              className="min-w-[180px]"
            />
          )}
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split(':') as [typeof sortBy, typeof sortOrder]
              setSortBy(field)
              setSortOrder(order)
            }}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="createdAt:desc">Newest first</option>
            <option value="createdAt:asc">Oldest first</option>
            <option value="name:asc">Name A→Z</option>
            <option value="name:desc">Name Z→A</option>
            <option value="sku:asc">SKU A→Z</option>
            <option value="costPrice:asc">Cost ↑</option>
            <option value="costPrice:desc">Cost ↓</option>
            <option value="sellingPrice:asc">Price ↑</option>
            <option value="sellingPrice:desc">Price ↓</option>
          </select>
          {(search ||
            lifecycle ||
            primaryCategoryId ||
            sortBy !== 'createdAt' ||
            sortOrder !== 'desc') && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load items</p>
            <p className="mt-1 text-xs text-red-600">Please try refreshing the page.</p>
          </div>
        )}

        {/* Table */}
        <ItemMasterTable
          items={items}
          isLoading={isLoading}
          isFetching={isFetching}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={(item) => setEditTarget(item)}
          onDelete={handleDelete}
          onLifecycleChange={(id, lc) => updateLifecycle(id, lc)}
          onViewBundle={(item) => setSelectedBundleItem(item)}
          onViewVariants={(item) => setSelectedVariantItem(item)}
        />

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <span>
              Showing {(page - 1) * pagination.limit + 1}–
              {Math.min(page * pagination.limit, pagination.total)} of {pagination.total} items
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
              <span className="px-3 py-1.5 font-medium text-zinc-700">
                {page} / {pagination.totalPages}
              </span>
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

      {/* Create Modal */}
      <CreateItemModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={(data) => createItem(data)}
        isSubmitting={isCreating}
        categories={categories}
        uomOptions={uomOptions}
        groupOptions={groupOptions}
        subgroupOptions={subgroupOptions}
        brandOptions={brandOptions}
        typeOptions={typeOptions}
      />

      {/* Edit Modal */}
      <EditItemModal
        isOpen={!!editTarget}
        item={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={(data: UpdateItemFormValues) => updateItem(editTarget!.id, data)}
        isSubmitting={isUpdating}
        categories={categories}
        uomOptions={uomOptions}
        onAttributeSubmit={(attrs) => updateItemAttributes(editTarget!.id, attrs)}
        isAttributeSubmitting={isUpdatingAttributes}
        groupOptions={groupOptions}
        subgroupOptions={subgroupOptions}
        brandOptions={brandOptions}
        typeOptions={typeOptions}
      />

      {/* Bundle Create Modal */}
      <CreateBundleModal
        isOpen={isBundleCreateOpen}
        onClose={() => setIsBundleCreateOpen(false)}
        onSubmit={createBundle}
        isSubmitting={isCreatingBundle}
        itemOptions={itemOptions}
        categoryOptions={categories}
        uomOptions={uomOptions}
      />

      {/* Bundle Detail Modal */}
      <BundleDetailModal
        isOpen={!!selectedBundleItem}
        bundle={selectedBundleItem}
        components={bundleComponents}
        availableQty={bundleAvailableQty}
        isLoading={isLoadingComponents}
        itemOptions={itemOptions}
        onAddComponent={addBundleComponent}
        isAddingComponent={isAddingBundleComponent}
        onRemoveComponent={removeBundleComponent}
        removingComponentId={removingComponentId}
        canEdit={canCreateBundle}
        onClose={() => setSelectedBundleItem(null)}
      />

      {/* Bulk Image Import Modal */}
      <BulkImageImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        items={itemOptions}
      />

      {/* Variants Modal */}
      <VariantsModal
        isOpen={!!selectedVariantItem}
        item={selectedVariantItem}
        variants={variants}
        isLoading={isLoadingVariants}
        onClose={() => setSelectedVariantItem(null)}
        onCreateVariant={createVariant}
        isCreating={isCreatingVariant}
        onEditItem={(item) => {
          setSelectedVariantItem(null)
          setEditTarget(item)
        }}
      />

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Delete Item</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Are you sure you want to delete{' '}
              <span className="font-medium text-zinc-800">{deleteTarget.name}</span>? This action
              cannot be undone. Items with stock on hand cannot be deleted.
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
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
