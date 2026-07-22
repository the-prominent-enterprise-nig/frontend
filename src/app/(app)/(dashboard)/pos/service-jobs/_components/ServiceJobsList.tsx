'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { useServiceDrafts, useServiceDraft } from '../_hooks/useServiceDrafts'
import { ServiceJobFormModal } from './ServiceJobFormModal'
import { ServiceJobDetailModal } from './ServiceJobDetailModal'
import { ServiceJobSourcingModal } from './ServiceJobSourcingModal'
import { ServiceJobStartInstallModal } from './ServiceJobStartInstallModal'
import { SERVICE_DRAFT_STATUS_STYLES } from './status-styles'
import { customerDisplayName } from './service-draft-utils'
import { hasPermission } from '@/src/hooks/usePermission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { ServiceDraft, ServiceDraftStatus } from '@/src/schema/pos/service-drafts'

const STATUS_TABS: { label: string; value: ServiceDraftStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'draft' },
  { label: 'Sourcing', value: 'sourcing' },
  { label: 'Installing', value: 'installing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

function StatusBadge({ status }: { status: ServiceDraftStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${SERVICE_DRAFT_STATUS_STYLES[status] ?? 'bg-zinc-100 text-zinc-600'}`}
    >
      {status}
    </span>
  )
}

export function ServiceJobsList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, POS_PERMISSIONS.SERVICE_DRAFTS_CREATE)
  const canEdit = hasPermission(session, POS_PERMISSIONS.SERVICE_DRAFTS_UPDATE)
  const canCancel = hasPermission(session, POS_PERMISSIONS.SERVICE_DRAFTS_CANCEL)
  const canSource = hasPermission(session, POS_PERMISSIONS.SERVICE_DRAFTS_SOURCE)
  const canInstall = hasPermission(session, POS_PERMISSIONS.SERVICE_DRAFTS_INSTALL)
  const canComplete = hasPermission(session, POS_PERMISSIONS.SERVICE_DRAFTS_COMPLETE)

  // Mirrors PurchaseRequestList's lockedBranch: branch-scoped actors
  // (Cashier/Branch Manager) get their branch pinned since the backend
  // force-resolves it server-side regardless of what's submitted; a Business
  // Owner (no branchId on their session) gets an editable branch picker.
  const lockedBranch = session.branchId
    ? { id: session.branchId, name: session.branchName ?? 'Your branch' }
    : null

  const {
    items,
    isLoading,
    statusFilter,
    setStatusFilter,
    createDraft,
    isCreating,
    updateDraft,
    isUpdating,
    cancelDraft,
    isCancelling,
    confirmSourcing,
    isSourcing,
    startInstall,
    isStartingInstall,
    recordActuals,
    isRecordingActuals,
    completeDraft,
    isCompleting,
  } = useServiceDrafts()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingDraft, setEditingDraft] = useState<ServiceDraft | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sourcingDraft, setSourcingDraft] = useState<ServiceDraft | null>(null)
  const [installingDraft, setInstallingDraft] = useState<ServiceDraft | null>(null)

  // The list row may not carry populated lines/nested item data, so the
  // detail modal (and edit prefill) re-fetch the full record by id.
  const { draft: selectedDraft, isLoading: isLoadingDetail } = useServiceDraft(selectedId)

  function closeDetail() {
    setSelectedId(null)
  }

  function handleEditFromDetail(draft: ServiceDraft) {
    setSelectedId(null)
    setEditingDraft(draft)
  }

  function handleSourceFromDetail(draft: ServiceDraft) {
    // Deliberately does NOT clear selectedId (unlike handleEditFromDetail) —
    // the sourcing modal stacks on top of the detail modal instead of
    // replacing it, so confirming leaves the user looking at the updated
    // detail (new status, linked PR) instead of dropping them back at the
    // bare list.
    setSourcingDraft(draft)
  }

  function handleStartInstallFromDetail(draft: ServiceDraft) {
    // Same stacking behavior as handleSourceFromDetail — the detail modal
    // stays open underneath so confirming shows the result immediately.
    setInstallingDraft(draft)
  }

  async function handleCancelFromDetail(draft: ServiceDraft) {
    if (!window.confirm(`Cancel service job "${draft.title}"? This cannot be undone.`)) return
    await cancelDraft(draft.id)
    closeDetail()
  }

  async function handleCompleteFromDetail(id: string) {
    if (
      !window.confirm(
        'Complete this job? This deducts the recorded actual materials from stock and cannot be undone.'
      )
    )
      return
    await completeDraft(id)
  }

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Service Jobs</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Reopenable material estimates for install jobs (e.g. aircon + installation)
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
          >
            <Plus className="h-4 w-4" />
            New Service Job
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
            <p className="text-sm text-zinc-500">No service jobs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((draft) => (
                  <tr
                    key={draft.id}
                    onClick={() => setSelectedId(draft.id)}
                    className="cursor-pointer hover:bg-zinc-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-900">{draft.title}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {customerDisplayName(draft.customer)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {draft.branch?.name ?? <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={draft.status} />
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(draft.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <ServiceJobFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={async (data) => {
          await createDraft(data)
          setShowCreateModal(false)
        }}
        isCreating={isCreating}
        lockedBranch={lockedBranch}
      />

      <ServiceJobFormModal
        open={!!editingDraft}
        onClose={() => setEditingDraft(null)}
        draft={editingDraft}
        onUpdate={async (id, data) => {
          await updateDraft(id, data)
          setEditingDraft(null)
        }}
        isSaving={isUpdating}
        lockedBranch={lockedBranch}
      />

      <ServiceJobDetailModal
        open={!!selectedId}
        onClose={closeDetail}
        draft={selectedDraft}
        isLoading={isLoadingDetail}
        canEdit={canEdit}
        canCancel={canCancel}
        canSource={canSource}
        canInstall={canInstall}
        canComplete={canComplete}
        onEdit={handleEditFromDetail}
        onCancelJob={handleCancelFromDetail}
        onSource={handleSourceFromDetail}
        onStartInstall={handleStartInstallFromDetail}
        onSaveActuals={recordActuals}
        onCompleteJob={handleCompleteFromDetail}
        isCancelling={isCancelling}
        isRecordingActuals={isRecordingActuals}
        isCompleting={isCompleting}
      />

      <ServiceJobSourcingModal
        open={!!sourcingDraft}
        onClose={() => setSourcingDraft(null)}
        draftId={sourcingDraft?.id ?? null}
        draftTitle={sourcingDraft?.title}
        onConfirm={confirmSourcing}
        isConfirming={isSourcing}
      />

      <ServiceJobStartInstallModal
        open={!!installingDraft}
        onClose={() => setInstallingDraft(null)}
        draftId={installingDraft?.id ?? null}
        draftTitle={installingDraft?.title}
        onConfirm={startInstall}
        isConfirming={isStartingInstall}
      />
    </div>
  )
}
