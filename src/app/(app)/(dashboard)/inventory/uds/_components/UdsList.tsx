'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Truck,
  ArrowRight,
  Clock,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Wrench,
  Ban,
} from 'lucide-react'
import { useUdsManager } from '../_hooks/useUdsManager'
import CreateUdsModal from './CreateUdsModal'
import UpdateUdsStatusModal from './UpdateUdsStatusModal'
import UdsDetailModal from './UdsDetailModal'
import AssessUdsModal from './AssessUdsModal'
import SetRepairProviderModal from './SetRepairProviderModal'
import {
  UDS_REASON_LABELS,
  UDS_STATUS_LABELS,
  UDS_ASSESSMENT_LABELS,
  UDS_STATUSES,
  UDS_REASONS,
  type Uds,
  type UdsStatus,
  type UdsReason,
  type UdsAssessment,
} from '@/src/schema/inventory/uds'
import type {
  UpdateUdsStatusFormValues,
  AssessUdsFormValues,
  SetRepairProviderFormValues,
} from '@/src/schema/inventory/uds'

// Icon + color per status/assessment, mirroring TransferList's own
// STATUS_CONFIG pattern (not exported from there) for visual consistency
// across the inventory module's list tables.
const STATUS_CONFIG: Record<UdsStatus, { color: string; icon: React.ElementType }> = {
  issued: { color: 'bg-blue-100 text-blue-700', icon: Clock },
  in_transit: { color: 'bg-yellow-100 text-yellow-700', icon: Truck },
  received: { color: 'bg-purple-100 text-purple-700', icon: PackageCheck },
  completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  cancelled: { color: 'bg-zinc-100 text-zinc-500', icon: XCircle },
}

const ASSESSMENT_CONFIG: Record<UdsAssessment, { color: string; icon: React.ElementType }> = {
  repairable: { color: 'bg-green-100 text-green-700', icon: Wrench },
  unrepairable: { color: 'bg-red-100 text-red-700', icon: Ban },
}

const REASON_DOT: Record<UdsReason, string> = {
  repair: 'bg-red-500',
  maintenance: 'bg-orange-500',
  quality_check: 'bg-yellow-500',
  pull_out: 'bg-purple-500',
  loan: 'bg-blue-500',
}

// Mirrors TransferList's own STATUS_CONFIG colors (not exported from there) —
// kept minimal since this is just an inline reference badge, not the transfers
// module's own status UI.
const TRANSFER_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_transit: 'In Transit',
  received: 'Received',
  cancelled: 'Cancelled',
}

export default function UdsList() {
  const {
    records,
    pagination,
    isLoading,
    isFetching,
    error,
    statusFilter,
    reasonFilter,
    setStatusFilter,
    setReasonFilter,
    resetFilters,
    page,
    setPage,
    warehouseOptions,
    serialOptions,
    supplierOptions,
    createUds,
    isCreating,
    updateStatus,
    isUpdatingStatus,
    assessUds,
    isAssessing,
    setRepairProvider,
    isSettingRepairProvider,
  } = useUdsManager()

  const [isCreateOpen, setCreateOpen] = useState(false)
  const [selectedUds, setSelectedUds] = useState<Uds | null>(null)
  const [viewUds, setViewUds] = useState<Uds | null>(null)
  const [assessingUds, setAssessingUds] = useState<Uds | null>(null)
  const [settingProviderUds, setSettingProviderUds] = useState<Uds | null>(null)

  const hasFilters = !!statusFilter || !!reasonFilter

  async function handleUpdateStatus(data: UpdateUdsStatusFormValues) {
    if (!selectedUds) return { success: false, error: 'No UDS selected', message: '' }
    return updateStatus(selectedUds.id, data)
  }

  async function handleAssess(data: AssessUdsFormValues) {
    if (!assessingUds) return { success: false, error: 'No UDS selected', message: '' }
    return assessUds(assessingUds.id, data)
  }

  async function handleSetRepairProvider(data: SetRepairProviderFormValues) {
    if (!settingProviderUds) return { success: false, error: 'No UDS selected', message: '' }
    return setRepairProvider(settingProviderUds.id, data)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 md:text-3xl">Unit Document Sheets</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Track units leaving the warehouse for repair, pull-out, maintenance, or loan.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-prominent-purple-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-prominent-purple-800"
          >
            <Plus className="h-4 w-4" />
            Issue UDS
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={statusFilter ?? ''}
            onChange={(e) => setStatusFilter((e.target.value as UdsStatus) || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Statuses</option>
            {UDS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {UDS_STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          <select
            value={reasonFilter ?? ''}
            onChange={(e) => setReasonFilter(e.target.value || undefined)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500"
          >
            <option value="">All Reasons</option>
            {UDS_REASONS.map((r) => (
              <option key={r} value={r}>
                {UDS_REASON_LABELS[r]}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="text-sm text-zinc-500 hover:text-zinc-700 underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Failed to load UDS records. Please try again.
          </div>
        )}

        {/* Table */}
        <div
          className={`overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div className="divide-y divide-zinc-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardCheck className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No Unit Document Sheets found</p>
              <p className="mt-1 text-xs text-zinc-400">
                {hasFilters
                  ? 'Try clearing your filters.'
                  : 'Issue a UDS to track units going for repair or pull-out.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Document
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Units / Provider
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Route
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden sm:table-cell">
                      Issued
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {records.map((uds) => {
                    const statusCfg = STATUS_CONFIG[uds.status]
                    const StatusIcon = statusCfg.icon
                    const assessmentCfg = uds.assessment ? ASSESSMENT_CONFIG[uds.assessment] : null
                    const AssessmentIcon = assessmentCfg?.icon

                    return (
                      <tr
                        key={uds.id}
                        onClick={() => setViewUds(uds)}
                        className="cursor-pointer hover:bg-zinc-50"
                      >
                        {/* Document: code + reason dot, primary/secondary line */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${REASON_DOT[uds.reason]}`}
                              aria-hidden
                            />
                            <span className="font-mono text-xs font-semibold text-zinc-800">
                              {uds.code}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-400">
                            {UDS_REASON_LABELS[uds.reason]}
                          </p>
                        </td>

                        {/* Status: lifecycle + assessment verdict stacked */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.color}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {UDS_STATUS_LABELS[uds.status]}
                          </span>
                          {uds.assessment && assessmentCfg && AssessmentIcon && (
                            <span
                              className={`mt-1 flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${assessmentCfg.color}`}
                            >
                              <AssessmentIcon className="h-3 w-3" />
                              {UDS_ASSESSMENT_LABELS[uds.assessment]}
                            </span>
                          )}
                        </td>

                        {/* Units / Provider: count on top, provider + RFS attachment below */}
                        <td className="px-4 py-3">
                          <p className="text-zinc-700">
                            {uds.lines.length} unit{uds.lines.length !== 1 ? 's' : ''}
                          </p>
                          {(uds.repairProvider || uds.rfsFormFile) && (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-400">
                              {uds.repairProvider?.name}
                              {uds.rfsFormFile && (
                                <Paperclip
                                  className="h-3 w-3 shrink-0"
                                  aria-label={`RFS form attached: ${uds.rfsFormFile.originalName}`}
                                />
                              )}
                            </p>
                          )}
                        </td>

                        {/* Route: warehouse, with an arrow to the auto-paired transfer if any */}
                        <td className="px-4 py-3">
                          <p className="text-zinc-700">{uds.warehouse?.code ?? '—'}</p>
                          {uds.linkedStockTransfer && (
                            <Link
                              href="/inventory/transfers"
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5 flex items-center gap-1 text-xs text-blue-700 hover:underline"
                            >
                              <ArrowRight className="h-3 w-3 shrink-0" />
                              {uds.linkedStockTransfer.transferNumber} (
                              {TRANSFER_STATUS_LABELS[uds.linkedStockTransfer.status] ??
                                uds.linkedStockTransfer.status}
                              )
                            </Link>
                          )}
                        </td>

                        <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">
                          {new Date(uds.createdAt).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {uds.reason === 'repair' &&
                              uds.status === 'received' &&
                              !uds.assessment && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setAssessingUds(uds)
                                  }}
                                  className="rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                                >
                                  Assess
                                </button>
                              )}
                            {uds.status !== 'completed' && uds.status !== 'cancelled' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedUds(uds)
                                }}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
                              >
                                Update
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && records.length > 0 && (
          <div className="flex items-center justify-between text-sm text-zinc-600">
            <p>
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="rounded-lg border border-zinc-200 p-1.5 hover:bg-zinc-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-zinc-700 font-medium">
                {pagination.page} / {pagination.lastPage}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.lastPage}
                className="rounded-lg border border-zinc-200 p-1.5 hover:bg-zinc-100 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateUdsModal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={createUds}
        isSubmitting={isCreating}
        warehouseOptions={warehouseOptions}
        serialOptions={serialOptions}
        supplierOptions={supplierOptions}
      />

      {selectedUds && (
        <UpdateUdsStatusModal
          isOpen={!!selectedUds}
          onClose={() => setSelectedUds(null)}
          onSubmit={handleUpdateStatus}
          isSubmitting={isUpdatingStatus}
          currentStatus={selectedUds.status}
        />
      )}

      <UdsDetailModal
        uds={viewUds}
        isOpen={!!viewUds}
        onClose={() => setViewUds(null)}
        onEditProvider={(u) => {
          setViewUds(null)
          setSettingProviderUds(u)
        }}
      />

      <AssessUdsModal
        uds={assessingUds}
        isOpen={!!assessingUds}
        onClose={() => setAssessingUds(null)}
        onSubmit={handleAssess}
        isSubmitting={isAssessing}
      />

      <SetRepairProviderModal
        uds={settingProviderUds}
        isOpen={!!settingProviderUds}
        onClose={() => setSettingProviderUds(null)}
        onSubmit={handleSetRepairProvider}
        isSubmitting={isSettingRepairProvider}
        supplierOptions={supplierOptions}
      />
    </div>
  )
}
