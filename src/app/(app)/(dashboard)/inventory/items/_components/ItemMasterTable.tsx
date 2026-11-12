'use client'

import { Archive, CheckCircle2, Layers, PauseCircle, Pencil, Trash2 } from 'lucide-react'
import type { ItemSummary } from '@/src/schema/inventory/items'
import { useUIShell } from '@/src/stores/ui-shell.store'
import { displayClassificationLabel } from '@/src/libs/format/text'
import { RowActionsMenu } from '@/src/components/ui/RowActionsMenu'
import Tooltip from '@/src/components/ui/Tooltip'
import { isItemLockedForReview } from '@/src/libs/inventory/item-edit'
import { ICON_BUTTON, TABLE_HEAD_ROW } from '../../master-data/_components/masterDataChrome'

// Type / Category = the sheet's TYPE / GROUP / SUBGROUP: Type is
// the item type; Category/Subgroup is the category tree — primaryCategory is the Subgroup when it has a parent, else the Group.
function groupName(item: ItemSummary): string | undefined {
  const name = item.primaryCategory?.parentCategory?.name ?? item.primaryCategory?.name
  return displayClassificationLabel(name)
}

function subgroupName(item: ItemSummary): string | undefined {
  if (!item.primaryCategory?.parentCategory) return undefined
  return displayClassificationLabel(item.primaryCategory.name)
}

function brandModelLabel(item: ItemSummary): string {
  const brand = displayClassificationLabel(item.brand?.name)
  const model = item.modelNumber ?? undefined
  if (brand && model) return `${brand} — ${model}`
  return brand ?? model ?? '—'
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
}

/** Edit sits on the row itself rather than in the ⋯ menu so it can be found
 * at a glance. Items mid-review are locked by the backend, so the button is
 * disabled there and says why. */
function EditItemButton({
  item,
  onEdit,
}: {
  item: ItemSummary
  onEdit: (item: ItemSummary) => void
}): React.JSX.Element {
  const locked = isItemLockedForReview(item)
  return (
    <Tooltip label={locked ? 'Locked while in review' : 'Edit item'} align="end">
      <button
        type="button"
        aria-label="Edit item"
        disabled={locked}
        onClick={() => onEdit(item)}
        className={`${ICON_BUTTON} disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent`}
      >
        <Pencil className="h-4 w-4" />
      </button>
    </Tooltip>
  )
}

export default function ItemMasterTable({
  items,
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead className={TABLE_HEAD_ROW}>
          <tr>
            <th className="px-4 py-2.5">Item</th>
            <th className="px-4 py-2.5">Type</th>
            <th className="px-4 py-2.5">Category</th>
            <th className="px-4 py-2.5">Brand / Model</th>
            {showActionsColumn && <th className="px-4 py-2.5" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eeeef1]">
          {items.map((item) => (
            <tr
              key={item.id}
              className="cursor-pointer hover:bg-[#fbfbfc]"
              onClick={() =>
                pushPanel({
                  type: 'item360',
                  itemId: item.id,
                  itemName: item.name,
                  context: 'catalog',
                  onEdit: canUpdate ? () => onEdit(item) : undefined,
                })
              }
            >
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[#1d1d26]">{item.name}</span>
                  {item.isBundle === true && (
                    <span className="rounded-full bg-[#f0e9fc] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5b21b6]">
                      Bundle
                    </span>
                  )}
                  {item.isService === true && (
                    <span className="rounded-full bg-[#fdf3e3] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8a5300]">
                      Service
                    </span>
                  )}
                  <ItemStateTag item={item} />
                  {(item._count?.serialNumbers ?? 0) > 0 && (
                    <span className="rounded-full bg-[#f1f1f4] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[#3d3d4a]">
                      {item._count?.serialNumbers} unit
                      {item._count?.serialNumbers !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-[#3d3d4a]">
                {displayClassificationLabel(item.type?.name) ?? '—'}
              </td>
              <td className="px-4 py-3 text-[#3d3d4a]">
                <div>{groupName(item) ?? '—'}</div>
                {subgroupName(item) && (
                  <div className="text-xs text-ink-subtle">{subgroupName(item)}</div>
                )}
              </td>
              <td className="px-4 py-3 text-[#3d3d4a]">{brandModelLabel(item)}</td>
              {showActionsColumn && (
                <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
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
                    {canUpdate && <EditItemButton item={item} onEdit={onEdit} />}
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
  )
}
