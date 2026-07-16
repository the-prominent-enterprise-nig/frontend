'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { usePurchaseRequests } from '../_hooks/usePurchaseRequests'
import { usePurchaseOrders } from '../../purchase-orders/_hooks/usePurchaseOrders'
import { CreatePurchaseRequestModal } from './CreatePurchaseRequestModal'
import { ApprovePrModal } from './ApprovePrModal'
import { RejectPrModal } from './RejectPrModal'
import { ConvertPrToPoModal } from './ConvertPrToPoModal'
import { hasPermission } from '@/src/hooks/usePermission'
import { PROCUREMENT_PERMISSIONS } from '@/src/libs/guards/procurement-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { PurchaseRequestSummary } from '@/src/schema/inventory/purchase-requests'

const STATUS_TABS = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Converted', value: 'converted' },
] as const

function StatusBadge({ status }: { status: PurchaseRequestSummary['status'] }) {
  const styles: Record<string, string> = {
    draft: 'bg-zinc-100 text-zinc-600',
    submitted: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
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

function ApprovalTierBadges({ pr }: { pr: PurchaseRequestSummary }) {
  if (pr.status !== 'submitted') return null
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {pr.approvals.map((approval) => {
        const tierStyles: Record<string, string> = {
          pending: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
          approved: 'bg-green-100 text-green-700 border border-green-200',
          rejected: 'bg-red-100 text-red-700 border border-red-200',
        }
        return (
          <span
            key={approval.id}
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tierStyles[approval.status] ?? 'bg-zinc-100 text-zinc-600'}`}
          >
            Tier {approval.tier}: {approval.status}
          </span>
        )
      })}
    </div>
  )
}

export function PurchaseRequestList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, PROCUREMENT_PERMISSIONS.PR_CREATE)
  const canApprove = hasPermission(session, PROCUREMENT_PERMISSIONS.PR_APPROVE)
  const canReject = hasPermission(session, PROCUREMENT_PERMISSIONS.PR_REJECT)
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
    submitPR,
    isSubmitting,
    approvePR,
    isApproving,
    rejectPR,
    isRejecting,
    cancelPR,
    isCancelling,
  } = usePurchaseRequests()

  const { convertFromPr, isConverting } = usePurchaseOrders()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [approvingPr, setApprovingPr] = useState<PurchaseRequestSummary | null>(null)
  const [rejectingPr, setRejectingPr] = useState<PurchaseRequestSummary | null>(null)
  const [convertingPr, setConvertingPr] = useState<PurchaseRequestSummary | null>(null)

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
            New Purchase Request
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
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Lines
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
                  <tr key={pr.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-zinc-900">{pr.code}</span>
                      {pr.reason && (
                        <p className="mt-0.5 text-xs text-zinc-400 line-clamp-1">{pr.reason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={pr.status} />
                      <ApprovalTierBadges pr={pr} />
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {pr.branch?.name ?? <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{pr.lines.length}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(pr.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {pr.status === 'draft' && (
                          <>
                            {canCreate && (
                              <button
                                type="button"
                                onClick={() => submitPR(pr.id)}
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
                            {canApprove && (
                              <button
                                type="button"
                                onClick={() => setApprovingPr(pr)}
                                disabled={isApproving}
                                className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                Approve
                              </button>
                            )}
                            {canReject && (
                              <button
                                type="button"
                                onClick={() => setRejectingPr(pr)}
                                disabled={isRejecting}
                                className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                Reject
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
                        {pr.status === 'approved' && canConvert && (
                          <button
                            type="button"
                            onClick={() => setConvertingPr(pr)}
                            disabled={isConverting}
                            className="rounded-md bg-prominent-purple-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
                          >
                            Convert to PO
                          </button>
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
      <CreatePurchaseRequestModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={async (data) => {
          await createPR(data)
          setShowCreateModal(false)
        }}
        isCreating={isCreating}
      />

      <ApprovePrModal
        open={!!approvingPr}
        onClose={() => setApprovingPr(null)}
        pr={approvingPr}
        onApprove={async (id, data) => {
          await approvePR(id, data)
          setApprovingPr(null)
        }}
        isApproving={isApproving}
      />

      <RejectPrModal
        open={!!rejectingPr}
        onClose={() => setRejectingPr(null)}
        pr={rejectingPr}
        onReject={async (id, data) => {
          await rejectPR(id, data)
          setRejectingPr(null)
        }}
        isRejecting={isRejecting}
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
    </div>
  )
}
