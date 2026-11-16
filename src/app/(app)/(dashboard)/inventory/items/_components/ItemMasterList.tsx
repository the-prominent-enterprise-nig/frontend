'use client'

import { useState } from 'react'
import { Search, X, Package } from 'lucide-react'
import { useItemMaster } from '../_hooks/useItemMaster'
import EditItemModal from './EditItemModal'
import ItemMasterTable from './ItemMasterTable'
import ItemApprovalActionModal from './ItemApprovalActionModal'
import ItemRejectModal from './ItemRejectModal'
import BundleDetailModal from '../../bundles/_components/BundleDetailModal'
import AddUnitsModal from './AddUnitsModal'
import { useReceivingWarehouses } from './item-create-fields'
import type { ItemSummary, UpdateItemFormValues } from '@/src/schema/inventory/items'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import CategorySelect from '@/src/components/ui/CategorySelect'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { displayClassificationLabel } from '@/src/libs/format/text'
import {
  ListFooterPager,
  STOCK_LEDGER_PAGE_SIZES,
} from '@/src/components/inventory/ListFooterPager'
import { CONTROL_CHROME, PLEX } from '@/src/libs/design/plex'
import {
  EmptyState,
  ListHeader,
  ListSearch,
  LoadError,
  PAGE_INNER,
  PAGE_SHELL,
  TableCard,
} from '../../master-data/_components/masterDataChrome'

/** Branches filter: every branch plus the standalone warehouses (Panay,
 * Negros), each labelled by name. */
function useBranchFilterOptions(): { value: string; label: string }[] {
  const warehouses = useReceivingWarehouses(true)
  return warehouses.map((w) => ({ value: w.id, label: w.branch?.name ?? w.name }))
}

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name A→Z' },
  { value: 'name:desc', label: 'Name Z→A' },
  { value: 'sku:asc', label: 'SKU A→Z' },
]

export default function ItemMasterList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.ITEMS_CREATE)
  const canUpdate = hasPermission(session, INVENTORY_PERMISSIONS.ITEMS_UPDATE)
  const canDelete = hasPermission(session, INVENTORY_PERMISSIONS.ITEMS_DELETE)
  const canManageLifecycle = hasPermission(session, INVENTORY_PERMISSIONS.ITEMS_MANAGE_LIFECYCLE)
  const canReadAttributes = hasPermission(session, INVENTORY_PERMISSIONS.ATTRIBUTES_READ)
  const canCreateBundle = hasPermission(session, INVENTORY_PERMISSIONS.BUNDLES_CREATE)
  // Scenario 16 — Item Master Governance. Submitting a draft reuses the
  // update permission (same convention Purchase Requests uses for its own
  // submit action) rather than introducing a separate permission for it.
  const canSubmitReview = canUpdate
  const canConfirmAccounting = hasPermission(
    session,
    INVENTORY_PERMISSIONS.ITEMS_CONFIRM_TAX_MAPPING
  )
  const canApproveItem = hasPermission(session, INVENTORY_PERMISSIONS.ITEMS_APPROVE)

  const {
    items,
    pagination,
    categories,
    uomOptions,
    brandOptions,
    typeOptions,
    isLoading,
    isFetching,
    error,
    search,
    setSearch,
    primaryCategoryId,
    setPrimaryCategoryId,
    typeId,
    setTypeId,
    warehouseId,
    setWarehouseId,
    resetFilters,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    page,
    setPage,
    limit,
    setLimit,
    updateItem,
    isUpdating,
    updateItemAttributes,
    isUpdatingAttributes,
    updateLifecycle,
    deleteItem,
    selectedBundleItem,
    setSelectedBundleItem,
    bundleComponents,
    bundleAvailableQty,
    isLoadingComponents,
    itemOptions,
    addBundleComponent,
    isAddingBundleComponent,
    removeBundleComponent,
    removingComponentId,
    submitItem,
    isSubmitting,
    confirmAccounting,
    isConfirmingAccounting,
    rejectAccounting,
    isRejectingAccounting,
    approveItem,
    isApprovingItem,
    rejectItem,
    isRejectingItem,
  } = useItemMaster()

  const [addUnitsTarget, setAddUnitsTarget] = useState<ItemSummary | null>(null)
  const [editTarget, setEditTarget] = useState<ItemSummary | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ItemSummary | null>(null)
  // Scenario 16 — Item Master Governance
  const [confirmingAccountingItem, setConfirmingAccountingItem] = useState<ItemSummary | null>(null)
  const [rejectingAccountingItem, setRejectingAccountingItem] = useState<ItemSummary | null>(null)
  const [approvingItem, setApprovingItem] = useState<ItemSummary | null>(null)
  const [rejectingItem, setRejectingItem] = useState<ItemSummary | null>(null)

  function handleDelete(item: ItemSummary) {
    setDeleteTarget(item)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await deleteItem(deleteTarget.id)
    setDeleteTarget(null)
  }

  const branchOptions = useBranchFilterOptions()

  const filtered = !!(search || primaryCategoryId || typeId || warehouseId)
  const showClear = filtered || sortBy !== 'name' || sortOrder !== 'asc'

  return (
    <div className={`${PAGE_SHELL} ${PLEX}`}>
      <div className={PAGE_INNER}>
        <ListHeader
          title="Item Master"
          description="Create and manage product records across the system."
        />

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ListSearch
              value={search}
              onChange={setSearch}
              placeholder="Search by name, brand, model, type, category or serial number…"
              className="flex-1"
            />
            {showClear && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-[13px] text-ink-muted hover:bg-[#f0e9fc] hover:text-[#5b21b6]"
              >
                <X className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
          {/* Filters share one row, each stretching to fill it. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none">
            {/* Scenario 56 — items with units on hand at that branch. */}
            <SearchableSelect
              className="w-full"
              value={warehouseId ?? ''}
              onChange={(v) => setWarehouseId(v || undefined)}
              placeholder="All Branches"
              ariaLabel="Branches"
              chrome={CONTROL_CHROME}
              clearable
              options={branchOptions}
            />
            {/* Type / Category = the sheet's TYPE / GROUP / SUBGROUP:
              Type is the item type, Category/Subgroup the category tree. */}
            <SearchableSelect
              className="w-full"
              value={typeId ?? ''}
              onChange={(v) => setTypeId(v || undefined)}
              placeholder="All Types"
              ariaLabel="Type"
              chrome={CONTROL_CHROME}
              clearable
              options={typeOptions.map((t) => ({
                value: t.id,
                label: displayClassificationLabel(t.name) ?? t.name,
              }))}
            />
            {categories.length > 0 && (
              <CategorySelect
                value={primaryCategoryId}
                onChange={setPrimaryCategoryId}
                options={categories}
                placeholder="All Categories"
                aria-label="Category or subgroup"
                className="w-full"
              />
            )}
            <SearchableSelect
              className="w-full"
              value={`${sortBy}:${sortOrder}`}
              onChange={(v) => {
                if (!v) return
                const [field, order] = v.split(':') as [typeof sortBy, typeof sortOrder]
                setSortBy(field)
                setSortOrder(order)
              }}
              ariaLabel="Sort by"
              chrome={CONTROL_CHROME}
              options={SORT_OPTIONS}
            />
          </div>
        </div>

        {error && <LoadError message="Failed to load items — try refreshing the page." />}

        <TableCard fetching={isFetching && !isLoading}>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-ink-muted">Loading items…</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={filtered ? <Search className="h-8 w-8" /> : <Package className="h-10 w-10" />}
              title={filtered ? 'No items match' : 'No items yet'}
              hint={filtered ? undefined : 'Add items from the Add Item tab.'}
            />
          ) : (
            <>
              <ItemMasterTable
                items={items}
                canUpdate={canUpdate}
                canDelete={canDelete}
                canManageLifecycle={canManageLifecycle}
                onEdit={(item) => setEditTarget(item)}
                onDelete={handleDelete}
                onLifecycleChange={(id, lc) => updateLifecycle(id, lc)}
                onViewBundle={(item) => setSelectedBundleItem(item)}
                onAddUnits={canCreate ? (item) => setAddUnitsTarget(item) : undefined}
                canSubmitReview={canSubmitReview}
                canConfirmAccounting={canConfirmAccounting}
                canApproveItem={canApproveItem}
                isSubmittingReview={isSubmitting}
                onSubmitReview={(item) => submitItem(item.id)}
                onConfirmAccounting={(item) => setConfirmingAccountingItem(item)}
                onRejectAccounting={(item) => setRejectingAccountingItem(item)}
                onApproveItem={(item) => setApprovingItem(item)}
                onRejectItem={(item) => setRejectingItem(item)}
              />
              <ListFooterPager
                page={page}
                pageCount={pagination.totalPages}
                total={pagination.total}
                limit={limit}
                noun="items"
                onPageChange={setPage}
                onLimitChange={(n) => {
                  setLimit(n)
                  setPage(1)
                }}
                pageSizes={STOCK_LEDGER_PAGE_SIZES}
              />
            </>
          )}
        </TableCard>
      </div>

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
        canReadAttributes={canReadAttributes}
        brandOptions={brandOptions}
        typeOptions={typeOptions}
      />

      <AddUnitsModal item={addUnitsTarget} onClose={() => setAddUnitsTarget(null)} />

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

      {/* Scenario 16 — Item Master Governance modals */}
      <ItemApprovalActionModal
        open={!!confirmingAccountingItem}
        onClose={() => setConfirmingAccountingItem(null)}
        item={confirmingAccountingItem}
        title="Confirm Tax/GL Mapping"
        actionLabel="Confirm"
        onConfirm={async (id, data) => {
          await confirmAccounting(id, data)
        }}
        isSubmitting={isConfirmingAccounting}
      />
      <ItemRejectModal
        open={!!rejectingAccountingItem}
        onClose={() => setRejectingAccountingItem(null)}
        item={rejectingAccountingItem}
        title="Reject — Tax/GL Mapping"
        onConfirm={async (id, data) => {
          await rejectAccounting(id, data)
        }}
        isSubmitting={isRejectingAccounting}
      />
      <ItemApprovalActionModal
        open={!!approvingItem}
        onClose={() => setApprovingItem(null)}
        item={approvingItem}
        title="Approve Item"
        actionLabel="Approve"
        onConfirm={async (id, data) => {
          await approveItem(id, data)
        }}
        isSubmitting={isApprovingItem}
      />
      <ItemRejectModal
        open={!!rejectingItem}
        onClose={() => setRejectingItem(null)}
        item={rejectingItem}
        title="Reject Item"
        onConfirm={async (id, data) => {
          await rejectItem(id, data)
        }}
        isSubmitting={isRejectingItem}
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
