'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  X,
} from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import UdsStatusBand from './UdsStatusBand'
import { STATUS_CONFIG, ASSESSMENT_CONFIG, REASON_DOT, TRANSFER_STATUS_LABELS } from './udsDisplay'
import { useUdsManager } from '../_hooks/useUdsManager'
import CreateUdsModal from './CreateUdsModal'
import { latestTrailLeg, outstandingTrailCount } from './DocumentTrail'
import UpdateUdsStatusModal from './UpdateUdsStatusModal'
import UdsDetailModal from './UdsDetailModal'
import AssessUdsModal from './AssessUdsModal'
import SetRepairProviderModal from './SetRepairProviderModal'
import WriteOffUdsModal from './WriteOffUdsModal'
import DispatchToProviderModal from './DispatchToProviderModal'
import ReceiveFromProviderModal from './ReceiveFromProviderModal'
import ReleaseToCustomerModal from './ReleaseToCustomerModal'
import type { SessionUser } from '@/src/libs/guards/permission'
import {
  UDS_REASON_LABELS,
  UDS_STATUS_LABELS,
  UDS_ASSESSMENT_LABELS,
  UDS_REASONS,
  type Uds,
} from '@/src/schema/inventory/uds'
import type {
  UpdateUdsStatusFormValues,
  AssessUdsFormValues,
  DispatchToProviderFormValues,
  ReceiveFromProviderFormValues,
  ReleaseToCustomerFormValues,
  SetRepairProviderFormValues,
  WriteOffUdsFormValues,
} from '@/src/schema/inventory/uds'

// Same control chrome as the Stock Returns filter row, so the two screens'
// narrowings look and focus alike.
const FILTER_INPUT =
  'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-prominent-purple-500 focus:ring-2 focus:ring-prominent-purple-100'

type StepAction = {
  label: string
  className: string
  run: (uds: Uds) => void
}

/**
 * The single next thing to do with a sheet, and — only where two paths are
 * genuinely open — the alternative.
 *
 * Every action was previously rendered independently, so a sheet at `received`
 * showed "Assess" next to "Update" and read as a choice between them when only
 * one was the actual next step. Worse on a custodial sheet, where Update's only
 * remaining target is a Completed the server now refuses: the button offered a
 * transition guaranteed to fail.
 *
 * `handlers` is passed in rather than closed over so this stays a plain table
 * of state -> step, readable end to end against the journey it describes.
 */
function buildNextStep(handlers: {
  assess: (uds: Uds) => void
  dispatch: (uds: Uds) => void
  receive: (uds: Uds) => void
  release: (uds: Uds) => void
  writeOff: (uds: Uds) => void
  advance: (uds: Uds) => void
}): (uds: Uds) => { next: StepAction | null; alt: StepAction | null } {
  const ASSESS: StepAction = {
    label: 'Assess',
    className: 'bg-green-50 text-green-700 hover:bg-green-100',
    run: handlers.assess,
  }
  const DISPATCH: StepAction = {
    label: 'Send to Service Centre',
    className: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    run: handlers.dispatch,
  }
  const RECEIVE: StepAction = {
    label: 'Receive Back',
    className: 'bg-teal-50 text-teal-700 hover:bg-teal-100',
    run: handlers.receive,
  }
  const RELEASE: StepAction = {
    label: 'Release to Customer',
    className: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    run: handlers.release,
  }
  const WRITE_OFF: StepAction = {
    label: 'Write Off',
    className: 'bg-red-50 text-red-700 hover:bg-red-100',
    run: handlers.writeOff,
  }
  const advanceTo = (label: string): StepAction => ({
    label,
    className: 'bg-prominent-purple-50 text-prominent-purple-700 hover:bg-prominent-purple-100',
    run: handlers.advance,
  })

  return (uds) => {
    const none = { next: null, alt: null }
    if (uds.status === 'completed' || uds.status === 'cancelled') return none

    if (uds.status === 'issued') return { next: advanceTo('Send to Main'), alt: null }
    if (uds.status === 'in_transit') return { next: advanceTo('Receive at Main'), alt: null }
    if (uds.status === 'at_provider') return { next: RECEIVE, alt: null }

    // Custodial sheets close only through the release, which is what issues
    // the DR and returns the serial to `sold`. Our own units close on a plain
    // status change, having come back into stock.
    const close = uds.customerId ? RELEASE : advanceTo('Complete')

    if (uds.status === 'repaired') return { next: close, alt: null }

    // received
    if (uds.reason === 'repair' && !uds.assessment) return { next: ASSESS, alt: null }
    if (uds.assessment === 'repairable') return { next: DISPATCH, alt: null }
    if (uds.assessment === 'unrepairable') {
      // The only genuine fork: the customer can collect the dead unit, or we
      // scrap it. Both are valid endings, so neither can be the sole button.
      const canWriteOff = !uds.writeOffAdjustmentId
      if (uds.customerId) return { next: RELEASE, alt: canWriteOff ? WRITE_OFF : null }
      return { next: canWriteOff ? WRITE_OFF : close, alt: null }
    }
    return { next: close, alt: null }
  }
}

export default function UdsList({ session }: { session: SessionUser }) {
  const {
    records,
    pagination,
    isLoading,
    isFetching,
    error,
    refetch,
    statusCounts,
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
    dispatchToProvider,
    isDispatching,
    receiveFromProvider,
    isReceivingFromProvider,
    releaseToCustomer,
    isReleasing,
    setRepairProvider,
    isSettingRepairProvider,
    writeOffUds,
    isWritingOff,
  } = useUdsManager()

  const [isCreateOpen, setCreateOpen] = useState(false)
  const [selectedUds, setSelectedUds] = useState<Uds | null>(null)
  const [viewUds, setViewUds] = useState<Uds | null>(null)
  const [assessingUds, setAssessingUds] = useState<Uds | null>(null)
  const [settingProviderUds, setSettingProviderUds] = useState<Uds | null>(null)
  const [writingOffUds, setWritingOffUds] = useState<Uds | null>(null)
  const [dispatchingUds, setDispatchingUds] = useState<Uds | null>(null)
  const [receivingUds, setReceivingUds] = useState<Uds | null>(null)
  const [releasingUds, setReleasingUds] = useState<Uds | null>(null)

  // Built once from the setters above; the table itself is state-independent.
  const nextStep = useMemo(
    () =>
      buildNextStep({
        assess: setAssessingUds,
        dispatch: setDispatchingUds,
        receive: setReceivingUds,
        release: setReleasingUds,
        writeOff: setWritingOffUds,
        advance: setSelectedUds,
      }),
    []
  )

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

  async function handleWriteOff(data: WriteOffUdsFormValues) {
    if (!writingOffUds) return { success: false, error: 'No UDS selected', message: '' }
    return writeOffUds(writingOffUds.id, data)
  }

  async function handleDispatch(data: DispatchToProviderFormValues) {
    if (!dispatchingUds) return { success: false, error: 'No UDS selected', message: '' }
    return dispatchToProvider(dispatchingUds.id, data)
  }

  async function handleReceiveFromProvider(data: ReceiveFromProviderFormValues) {
    if (!receivingUds) return { success: false, error: 'No UDS selected', message: '' }
    return receiveFromProvider(receivingUds.id, data)
  }

  async function handleRelease(data: ReleaseToCustomerFormValues) {
    if (!releasingUds) return { success: false, error: 'No UDS selected', message: '' }
    return releaseToCustomer(releasingUds.id, data)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Same header chrome as Stock Returns and Stock Transfers — these
            three inventory movement screens share one surface. */}
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#17171c]">
              Unit Document Sheets
            </h1>
            <p className="text-[13px] text-[#5b5b6b]">
              Track units leaving the branch for repair, pull-out, maintenance, or loan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-[9px]">
            <Tooltip label="Reload the list">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh"
                className="flex items-center gap-[7px] rounded-lg border border-[#d3d3db] bg-white px-[14px] py-[9px] text-[13px] font-medium text-[#17171c] hover:border-[#a3a3b2] hover:bg-[#faf9fb] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-[7px] rounded-lg bg-[#5b21b6] px-[15px] py-[9px] text-[13px] font-semibold text-white hover:bg-[#4a189b]"
            >
              <Plus className="h-3.5 w-3.5" />
              Issue UDS
            </button>
          </div>
        </div>

        <UdsStatusBand counts={statusCounts} selected={statusFilter} onSelect={setStatusFilter} />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={reasonFilter ?? ''}
            onChange={(e) => setReasonFilter(e.target.value || undefined)}
            aria-label="Reason"
            className={`${FILTER_INPUT} cursor-pointer`}
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
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Latest document
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
                    const latestLeg = latestTrailLeg(uds)
                    const outstandingDocs = outstandingTrailCount(uds)
                    const isClosed = uds.status === 'completed' || uds.status === 'cancelled'
                    const { next, alt } = nextStep(uds)
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
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.badge}`}
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

                        {/* Route: branch, with an arrow to the auto-paired transfer if any */}
                        <td className="px-4 py-3">
                          <p className="text-zinc-700">
                            {uds.warehouse?.branch?.name ?? uds.warehouse?.name ?? '—'}
                          </p>
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

                        {/* How far the unit has got on paper, which is not
                            always what its status claims — a UDS sitting at
                            "at provider" with no dispatch DR recorded is a
                            unit nobody can prove was handed over. */}
                        <td className="px-4 py-3 hidden md:table-cell">
                          {latestLeg ? (
                            <p className="font-mono text-xs text-zinc-700">{latestLeg.number}</p>
                          ) : (
                            <span className="text-xs text-zinc-400">None recorded</span>
                          )}
                          {/* The gap, not the leg's own name: the label only
                              repeated what the number already said, while the
                              question this column exists to answer is which
                              sheets somebody has to go chase paper for. */}
                          {outstandingDocs > 0 && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
                              {outstandingDocs} outstanding
                            </p>
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
                            {/* One named step, not a row of every form that
                                happens to be legal. "Assess" and "Update" side
                                by side read as alternatives when only one of
                                them is the next thing to do — and on a
                                custodial sheet Update now offers only a
                                Completed the server refuses. Cancel stays
                                reachable as the quiet secondary. */}
                            {next && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  next.run(uds)
                                }}
                                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${next.className}`}
                              >
                                {next.label}
                              </button>
                            )}
                            {alt && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  alt.run(uds)
                                }}
                                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${alt.className}`}
                              >
                                {alt.label}
                              </button>
                            )}
                            {!isClosed && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedUds(uds)
                                }}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                              >
                                Cancel
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
        currentUserBranchId={session.branchId}
      />

      {selectedUds && (
        <UpdateUdsStatusModal
          isOpen={!!selectedUds}
          onClose={() => setSelectedUds(null)}
          onSubmit={handleUpdateStatus}
          isSubmitting={isUpdatingStatus}
          currentStatus={selectedUds.status}
          isCustodial={!!selectedUds.customerId}
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
        onAdvance={(u) => {
          setViewUds(null)
          setSelectedUds(u)
        }}
      />

      <AssessUdsModal
        uds={assessingUds}
        isOpen={!!assessingUds}
        onClose={() => setAssessingUds(null)}
        onSubmit={handleAssess}
        isSubmitting={isAssessing}
        supplierOptions={supplierOptions}
      />

      <SetRepairProviderModal
        uds={settingProviderUds}
        isOpen={!!settingProviderUds}
        onClose={() => setSettingProviderUds(null)}
        onSubmit={handleSetRepairProvider}
        isSubmitting={isSettingRepairProvider}
        supplierOptions={supplierOptions}
      />

      <WriteOffUdsModal
        uds={writingOffUds}
        isOpen={!!writingOffUds}
        onClose={() => setWritingOffUds(null)}
        onSubmit={handleWriteOff}
        isSubmitting={isWritingOff}
      />

      <DispatchToProviderModal
        uds={dispatchingUds}
        isOpen={!!dispatchingUds}
        onClose={() => setDispatchingUds(null)}
        onSubmit={handleDispatch}
        isSubmitting={isDispatching}
      />

      <ReceiveFromProviderModal
        uds={receivingUds}
        isOpen={!!receivingUds}
        onClose={() => setReceivingUds(null)}
        onSubmit={handleReceiveFromProvider}
        isSubmitting={isReceivingFromProvider}
      />

      <ReleaseToCustomerModal
        uds={releasingUds}
        isOpen={!!releasingUds}
        onClose={() => setReleasingUds(null)}
        onSubmit={handleRelease}
        isSubmitting={isReleasing}
      />
    </div>
  )
}
