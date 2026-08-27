'use client'

import { useState } from 'react'
import { Plus, Loader2, Send } from 'lucide-react'
import { usePurchaseRequests } from '../_hooks/usePurchaseRequests'
import { usePurchaseOrders } from '../../purchase-orders/_hooks/usePurchaseOrders'
import { CreatePoModal } from '../../purchase-orders/_components/CreatePoModal'
import { ConvertPrToPoModal } from './ConvertPrToPoModal'
import { ViewPurchaseRequestModal } from './ViewPurchaseRequestModal'
import { ConfirmActionModal } from '@/src/components/inventory/ConfirmActionModal'
import { hasPermission } from '@/src/hooks/usePermission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { PurchaseRequestSummary } from '@/src/schema/inventory/purchase-requests'

const STATUS_TABS = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Converted', value: 'converted' },
] as const

function StatusBadge({ status }: { status: PurchaseRequestSummary['status'] }) {
  const styles: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-600',
    submitted: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-zinc-100 text-zinc-500',
    converted: 'bg-purple-100 text-purple-700',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status] ?? 'bg-zinc-100 text-zinc-600'}`}
    >
      {status}
    </span>
  )
}

const fmtPHP = (n: number) =>
  n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })

// Same freebie-excluding qty*unitPrice sum CreatePoModal/PurchaseOrderFormFields
// use for the create-form subtotal — a PR now carries firm per-line pricing,
// same as a PO would.
function prTotal(pr: PurchaseRequestSummary): number {
  return pr.lines.reduce((sum, line) => {
    if (line.isFreebie) return sum
    const qty = Number(line.quantity) || 0
    const price = Number(line.unitPrice) || 0
    return sum + qty * price
  }, 0)
}

export function PurchaseRequestList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, PROCUREMENT_PERMISSIONS.PR_CREATE)
  const canEdit = hasPermission(session, PROCUREMENT_PERMISSIONS.PR_UPDATE)
  const canCancel = hasPermission(session, PROCUREMENT_PERMISSIONS.PR_CANCEL)
  const canConvert = hasPermission(session, PROCUREMENT_PERMISSIONS.PO_CREATE)

  const {
    items,
    pagination,
    isLoading,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    createPR,
    isCreating,
    updatePR,
    isUpdating,
    submitPR,
    isSubmitting,
    cancelPR,
    isCancelling,
  } = usePurchaseRequests()

  const { convertFromPr, isConverting } = usePurchaseOrders()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingPr, setEditingPr] = useState<PurchaseRequestSummary | null>(null)
  const [submittingPr, setSubmittingPr] = useState<PurchaseRequestSummary | null>(null)
  const [convertingPr, setConvertingPr] = useState<PurchaseRequestSummary | null>(null)
  const [viewingPr, setViewingPr] = useState<PurchaseRequestSummary | null>(null)

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Purchase Requests</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage and track purchase requests across your organisation
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
          >
            <Plus className="h-4 w-4" />
            New Purchase
          </button>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-zinc-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={String(tab.value)}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              statusFilter === tab.value
                ? 'border-prominent-purple-600 text-prominent-purple-700'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-500">No purchase requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Lines
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((pr) => (
                  <tr
                    key={pr.id}
                    onClick={() => setViewingPr(pr)}
                    className="cursor-pointer hover:bg-zinc-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-zinc-900">{pr.code}</span>
                      {pr.reason && (
                        <p className="mt-0.5 text-xs text-zinc-400 line-clamp-1">{pr.reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {pr.supplier?.name ?? <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={pr.status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {pr.branch?.name ?? <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{pr.lines.length}</td>
                    <td className="px-4 py-3 text-right font-medium text-zinc-800">
                      {fmtPHP(prTotal(pr))}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(pr.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {pr.status === 'draft' && (
                          <>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => setEditingPr(pr)}
                                className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                              >
                                Edit
                              </button>
                            )}
                            {canCreate && (
                              <button
                                type="button"
                                onClick={() => setSubmittingPr(pr)}
                                disabled={isSubmitting}
                                className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                Submit
                              </button>
                            )}
                            {canCancel && (
                              <button
                                type="button"
                                onClick={() => cancelPR(pr.id)}
                                disabled={isCancelling}
                                className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            )}
                          </>
                        )}
                        {pr.status === 'submitted' && (
                          <>
                            {canConvert && (
                              <button
                                type="button"
                                onClick={() => setConvertingPr(pr)}
                                disabled={isConverting}
                                className="rounded-md bg-prominent-purple-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
                              >
                                Convert to PO
                              </button>
                            )}
                            {canCancel && (
                              <button
                                type="button"
                                onClick={() => cancelPR(pr.id)}
                                disabled={isCancelling}
                                className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            )}
                          </>
                        )}
                        {pr.status === 'converted' && pr.convertedToPo && (
                          <span className="text-xs text-purple-600 font-medium">
                            PO: {pr.convertedToPo.code}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.totalPages}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreatePoModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={async (data) => {
          await createPR(data)
          setShowCreateModal(false)
        }}
        isCreating={isCreating}
        currentUserBranchId={session.branchId}
      />

      <CreatePoModal
        open={!!editingPr}
        onClose={() => setEditingPr(null)}
        pr={editingPr}
        onUpdate={async (id, data) => {
          await updatePR(id, data)
          setEditingPr(null)
        }}
        isSaving={isUpdating}
        currentUserBranchId={session.branchId}
      />

      <ConfirmActionModal
        open={submittingPr !== null}
        onClose={() => setSubmittingPr(null)}
        title="Submit Purchase Request"
        icon={<Send className="h-5 w-5" />}
        iconColorClass="text-blue-600"
        summary={<p className="text-sm font-medium text-zinc-900">{submittingPr?.code}</p>}
        message="This sends the purchase request into the approval queue — you won't be able to edit it as a draft afterward."
        confirmLabel="Submit"
        confirmingLabel="Submitting…"
        confirmButtonClass="bg-blue-600 hover:bg-blue-700"
        onConfirm={async () => {
          if (submittingPr) await submitPR(submittingPr.id)
        }}
        isConfirming={isSubmitting}
      />

      <ConvertPrToPoModal
        open={!!convertingPr}
        onClose={() => setConvertingPr(null)}
        pr={convertingPr}
        onConvert={async (prId, data) => {
          await convertFromPr(prId, data)
          setConvertingPr(null)
        }}
        isConverting={isConverting}
      />

      <ViewPurchaseRequestModal
        open={!!viewingPr}
        onClose={() => setViewingPr(null)}
        pr={viewingPr}
      />
    </div>
  )
}
