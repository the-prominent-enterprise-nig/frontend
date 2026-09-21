'use client'

import { Archive, CheckCircle2, Layers, PauseCircle, Pencil, Trash2 } from 'lucide-react'
import type { ItemSummary } from '@/src/schema/inventory/items'
import type { StockBalance } from '@/src/schema/inventory/goods-receiving'
import { StockStatusBadge } from '@/src/components/inventory/StockStatusBadge'
import { stockStatusOf } from '@/src/libs/inventory/stock-status'
import { useUIShell } from '@/src/stores/ui-shell.store'
import { displayClassificationLabel } from '@/src/libs/format/text'
import { RowActionsMenu } from '@/src/components/ui/RowActionsMenu'

// "Group/Subgroup" classification lives on the category's own parent —
// primaryCategory is the leaf (subgroup) when it has a parent, in which case
// the parent is the main category to show here (matches OverviewTab).
function mainCategoryName(item: ItemSummary): string | undefined {
  const name = item.primaryCategory?.parentCategory?.name ?? item.primaryCategory?.name
  return displayClassificationLabel(name)
}

function brandModelLabel(item: ItemSummary): string {
  const brand = displayClassificationLabel(item.brand?.name)
  const model = item.modelNumber ?? undefined
  if (brand && model) return `${brand} — ${model}`
  return brand ?? model ?? '—'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
}

const LIFECYCLE_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  discontinued: 'bg-orange-100 text-orange-700',
  archived: 'bg-zinc-100 text-zinc-600',
}

// Scenario 16 — Item Master Governance. 'approved' is the steady-state for
// most items, so its badge is intentionally omitted from the table — only
// the statuses that need attention are called out.
const APPROVAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_accounting_confirmation: 'Pending Accounting',
  pending_approval: 'Pending Approval',
  rejected: 'Rejected',
}
const APPROVAL_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  pending_accounting_confirmation: 'bg-amber-100 text-amber-700',
  pending_approval: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
}

const LIFECYCLE_ACTIONS = [
  { lifecycle: 'active', label: 'Mark active', icon: CheckCircle2 },
  { lifecycle: 'discontinued', label: 'Discontinue', icon: PauseCircle },
  { lifecycle: 'archived', label: 'Archive', icon: Archive },
] as const

/** The Status column's old job, as a tag under the name: approval state
 * while an item is still in review, then lifecycle once it isn't active.
 * A normal approved, active item shows nothing. */
function ItemStateTag({ item }: { item: ItemSummary }): React.ReactElement | null {
  if (item.approvalStatus && item.approvalStatus !== 'approved') {
    return <ApprovalStatusBadge item={item} />
  }
  const lifecycle = item.lifecycle ?? 'active'
  if (lifecycle === 'active') return null
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${LIFECYCLE_COLORS[lifecycle] ?? LIFECYCLE_COLORS.active}`}
    >
      {lifecycle}
    </span>
  )
}

function ApprovalStatusBadge({ item }: { item: ItemSummary }) {
  const status = item.approvalStatus
  if (!status || status === 'approved') return null
  return (
    <span
      title={status === 'rejected' ? (item.rejectedReason ?? undefined) : undefined}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${APPROVAL_STATUS_COLORS[status] ?? 'bg-zinc-100 text-zinc-600'}`}
    >
      {APPROVAL_STATUS_LABELS[status] ?? status}
    </span>
  )
}

type Props = {
  items: ItemSummary[]
  isLoading: boolean
  isFetching: boolean
  canUpdate: boolean
  canDelete: boolean
  canManageLifecycle: boolean
  onEdit: (item: ItemSummary) => void
  onDelete: (item: ItemSummary) => void
  onLifecycleChange: (id: string, lifecycle: 'active' | 'discontinued' | 'archived') => void
  onViewBundle?: (item: ItemSummary) => void
  // Scenario 16 — Item Master Governance
  canSubmitReview: boolean
  canConfirmAccounting: boolean
  canApproveItem: boolean
  isSubmittingReview?: boolean
  onSubmitReview: (item: ItemSummary) => void
  onConfirmAccounting: (item: ItemSummary) => void
  onRejectAccounting: (item: ItemSummary) => void
  onApproveItem: (item: ItemSummary) => void
  onRejectItem: (item: ItemSummary) => void
  /** Scenario 56 — per-item stock roll-up; the Stock column is hidden when absent. */
  stockByItem?: Map<string, StockBalance>
}

/** A service has no stock; an item with no balance row anywhere has never
 * been stocked, which reads as Out of Stock. */
function ItemStockCell({
  item,
  balance,
}: {
  item: ItemSummary
  balance?: StockBalance
}): React.ReactElement {
  if (item.isService) return <span className="text-zinc-400">—</span>
  if (!balance) return <StockStatusBadge status="out" size="sm" />
  return (
    <StockStatusBadge
      status={stockStatusOf(balance)}
      inTransitQty={balance.inTransitQty}
      size="sm"
      stacked
    />
  )
}

export default function ItemMasterTable({
  items,
  isLoading,
  isFetching,
  canUpdate,
  canDelete,
  canManageLifecycle,
  onEdit,
  onDelete,
  onLifecycleChange,
  onViewBundle,
  canSubmitReview,
  canConfirmAccounting,
  canApproveItem,
  isSubmittingReview,
  onSubmitReview,
  onConfirmAccounting,
  onRejectAccounting,
  onApproveItem,
  onRejectItem,
  stockByItem,
}: Props) {
  const { pushPanel } = useUIShell()
  const showActionsColumn =
    canUpdate ||
    canDelete ||
    !!onViewBundle ||
    canSubmitReview ||
    canConfirmAccounting ||
    canApproveItem ||
    canManageLifecycle

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-zinc-100 px-6 py-4 last:border-0"
          >
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200" />
          </div>
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white py-16">
        <p className="text-sm font-medium text-zinc-500">No items found</p>
        <p className="mt-1 text-xs text-zinc-400">Create your first item to get started.</p>
      </div>
    )
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Item
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Category
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Brand / Model
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Price
              </th>
              {stockByItem && (
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Stock
                </th>
              )}
              {showActionsColumn && (
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((item) => (
              <tr
                key={item.id}
                className="cursor-pointer hover:bg-zinc-50"
                onClick={() =>
                  pushPanel({
                    type: 'item360',
                    itemId: item.id,
                    itemName: item.name,
                    context: 'catalog',
                  })
                }
              >
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900">{item.name}</span>
                    {item.isBundle === true && (
                      <span className="rounded-full bg-prominent-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-prominent-purple-700">
                        Bundle
                      </span>
                    )}
                    {item.isService === true && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        Service
                      </span>
                    )}
                    <ItemStateTag item={item} />
                    {(item._count?.serialNumbers ?? 0) > 0 && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                        {item._count?.serialNumbers} unit
                        {item._count?.serialNumbers !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-500">{mainCategoryName(item) ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-500">{brandModelLabel(item)}</td>
                <td className="px-4 py-3 text-right text-zinc-700">
                  {item.sellingPrice != null ? formatCurrency(item.sellingPrice) : '—'}
                </td>
                {stockByItem && (
                  <td className="px-4 py-3 text-center">
                    <ItemStockCell item={item} balance={stockByItem.get(item.id)} />
                  </td>
                )}
                {showActionsColumn && (
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {item.approvalStatus === 'draft' && canSubmitReview && (
                        <button
                          type="button"
                          onClick={() => onSubmitReview(item)}
                          disabled={isSubmittingReview}
                          className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Submit
                        </button>
                      )}
                      {item.approvalStatus === 'pending_accounting_confirmation' &&
                        canConfirmAccounting && (
                          <>
                            <button
                              type="button"
                              onClick={() => onConfirmAccounting(item)}
                              className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => onRejectAccounting(item)}
                              className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      {item.approvalStatus === 'pending_approval' && canApproveItem && (
                        <>
                          <button
                            type="button"
                            onClick={() => onApproveItem(item)}
                            className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectItem(item)}
                            className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <RowActionsMenu
                        items={[
                          ...(item.isBundle === true && onViewBundle
                            ? [
                                {
                                  label: 'Components',
                                  icon: Layers,
                                  onClick: () => onViewBundle(item),
                                },
                              ]
                            : []),
                          ...(canUpdate
                            ? [{ label: 'Edit', icon: Pencil, onClick: () => onEdit(item) }]
                            : []),
                          // Lifecycle is a post-approval concept (Scenario 16),
                          // so only offered once the item is approved.
                          ...(canManageLifecycle &&
                          (!item.approvalStatus || item.approvalStatus === 'approved')
                            ? LIFECYCLE_ACTIONS.filter(
                                (a) => a.lifecycle !== (item.lifecycle ?? 'active')
                              ).map((a) => ({
                                label: a.label,
                                icon: a.icon,
                                onClick: () => onLifecycleChange(item.id, a.lifecycle),
                              }))
                            : []),
                          ...(canDelete
                            ? [
                                {
                                  label: 'Delete',
                                  icon: Trash2,
                                  onClick: () => onDelete(item),
                                  variant: 'danger' as const,
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
