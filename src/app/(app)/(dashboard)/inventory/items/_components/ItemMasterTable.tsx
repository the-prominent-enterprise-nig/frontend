'use client'

import { useState, useEffect, useRef } from 'react'
import { Pencil, Trash2, ChevronDown, Layers, Palette, MoreVertical } from 'lucide-react'
import type { ComponentType } from 'react'
import type { ItemSummary } from '@/src/schema/inventory/items'
import { useUIShell } from '@/src/stores/ui-shell.store'
import { displayClassificationLabel } from '@/src/libs/format/text'

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

function ApprovalStatusBadge({ item }: { item: ItemSummary }) {
  const status = item.approvalStatus
  if (!status || status === 'approved') return null
  return (
    <span
      title={status === 'rejected' ? (item.rejectedReason ?? undefined) : undefined}
      className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${APPROVAL_STATUS_COLORS[status] ?? 'bg-zinc-100 text-zinc-600'}`}
    >
      {APPROVAL_STATUS_LABELS[status] ?? status}
    </span>
  )
}

type DropdownPos = { top: number; right: number }

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
  onViewVariants?: (item: ItemSummary) => void
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

function LifecycleDropdown({
  item,
  onLifecycleChange,
}: {
  item: ItemSummary
  onLifecycleChange: (id: string, lifecycle: 'active' | 'discontinued' | 'archived') => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<DropdownPos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node))
        return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  function handleOpen() {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
    })
    setOpen(true)
  }

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${LIFECYCLE_COLORS[item.lifecycle ?? 'active'] ?? LIFECYCLE_COLORS.active}`}
      >
        {item.lifecycle ?? 'active'}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-36 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {(['active', 'discontinued', 'archived'] as const).map((lc) => (
            <button
              key={lc}
              type="button"
              onClick={() => {
                onLifecycleChange(item.id, lc)
                setOpen(false)
              }}
              className="w-full px-3 py-1.5 text-left text-sm capitalize text-zinc-700 hover:bg-zinc-50"
            >
              {lc}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type RowMenuItem = {
  label: string
  icon: ComponentType<{ className?: string }>
  onClick: () => void
  variant?: 'danger'
}

/**
 * Overflow menu for a row's secondary actions (view-adjacent: components/
 * variants, edit, delete). Keeps the row's primary, time-sensitive actions
 * (governance Submit/Confirm/Approve/Reject) as direct buttons while
 * collapsing everything else — same fixed-position dropdown approach as
 * LifecycleDropdown above, since the table's own overflow-x-auto container
 * would otherwise clip an absolutely-positioned menu.
 */
function RowActionsMenu({ items }: { items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<DropdownPos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node) || menuRef.current?.contains(e.target as Node))
        return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  function handleToggle() {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + window.scrollY + 4,
      right: window.innerWidth - rect.right,
    })
    setOpen((o) => !o)
  }

  if (items.length === 0) return null

  return (
    <div className="relative inline-block">
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        title="More actions"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  item.onClick()
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                  item.variant === 'danger'
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
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
  onViewVariants,
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
    !!onViewVariants ||
    canSubmitReview ||
    canConfirmAccounting ||
    canApproveItem

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
                Cost Price
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Status
              </th>
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
                onClick={() => pushPanel({ type: 'item360', itemId: item.id, itemName: item.name })}
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-zinc-900">{item.name}</span>
                      {item.isBundle === true && (
                        <span className="rounded-full bg-prominent-purple-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-prominent-purple-700">
                          Bundle
                        </span>
                      )}
                      {item.hasVariants === true && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                          Variants
                        </span>
                      )}
                      {item.isService === true && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          Service
                        </span>
                      )}
                      {(item._count?.serialNumbers ?? 0) > 0 && (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                          {item._count?.serialNumbers} unit
                          {item._count?.serialNumbers !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-zinc-500">{item.sku}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-500">{mainCategoryName(item) ?? '—'}</td>
                <td className="px-4 py-3 text-zinc-500">{brandModelLabel(item)}</td>
                <td className="px-4 py-3 text-right text-zinc-700">
                  {item.costPrice != null
                    ? `₱${Number(item.costPrice).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                    : '—'}
                </td>
                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                  {/* Scenario 16: lifecycle (active/discontinued/archived) is a
                      post-publish concept — showing it alongside "Pending
                      Approval" reads as contradictory, so a governed item
                      (anything not yet approved) shows only its approval
                      status here; lifecycle only appears once approved. */}
                  {item.approvalStatus && item.approvalStatus !== 'approved' ? (
                    <ApprovalStatusBadge item={item} />
                  ) : canManageLifecycle ? (
                    <LifecycleDropdown item={item} onLifecycleChange={onLifecycleChange} />
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LIFECYCLE_COLORS[item.lifecycle ?? 'active'] ?? LIFECYCLE_COLORS.active}`}
                    >
                      {item.lifecycle ?? 'active'}
                    </span>
                  )}
                </td>
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
                          ...(!item.isBundle && onViewVariants
                            ? [
                                {
                                  label: 'Variants',
                                  icon: Palette,
                                  onClick: () => onViewVariants(item),
                                },
                              ]
                            : []),
                          ...(canUpdate
                            ? [{ label: 'Edit', icon: Pencil, onClick: () => onEdit(item) }]
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
