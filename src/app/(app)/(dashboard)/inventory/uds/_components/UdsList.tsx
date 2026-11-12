'use client'

import { ListFooterPager } from '@/src/components/inventory/ListFooterPager'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, ClipboardCheck, Paperclip, ArrowRight, AlertTriangle, X } from 'lucide-react'
import UdsStatusBand from './UdsStatusBand'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { STATUS_CONFIG, ASSESSMENT_CONFIG, REASON_DOT, TRANSFER_STATUS_LABELS } from './udsDisplay'
import { useUdsManager } from '../_hooks/useUdsManager'
import CreateUdsModal from './CreateUdsModal'
import { latestTrailLeg, outstandingTrailCount } from './DocumentTrail'
import UpdateUdsStatusModal from './UpdateUdsStatusModal'
import UdsDetailModal from './UdsDetailModal'
import AssessUdsModal from './AssessUdsModal'
import SetRepairProviderModal from './SetRepairProviderModal'
import WriteOffUdsModal from './WriteOffUdsModal'
import ReceiveFromProviderModal from './ReceiveFromProviderModal'
import { can, type SessionUser } from '@/src/libs/guards/permission'
import { saveStockTransferDraft } from '../../transfers/_components/stockTransferDraft'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import {
  UDS_REASON_LABELS,
  UDS_STATUS_LABELS,
  UDS_ASSESSMENT_LABELS,
  UDS_REASONS,
  type Uds,
} from '@/src/schema/inventory/uds'
import type {
  ManualUdsStatus,
  UpdateUdsStatusFormValues,
  AssessUdsFormValues,
  ReceiveFromProviderFormValues,
  SetRepairProviderFormValues,
  WriteOffUdsFormValues,
} from '@/src/schema/inventory/uds'
import { STOCK_TABLE_HEAD } from '@/src/libs/design/plex'
import { formatManilaDate } from '@/src/libs/format/manila-date'

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
  /** Scenario 72 Part 10 — one fixed step, confirmed in a small modal. */
  advance: (uds: Uds, target: ManualUdsStatus) => void
  /** The trip to main goes out on a new stock transfer. */
  sendToMain: (uds: Uds) => void
  /** A hop a stock transfer carries is moved there, not here. */
  viewTransfer: (transferNumber: string) => void
  /** A leg already on a DR is moved there — no second DR. */
  viewDr: (drId: string) => void
  /** The two DR legs are hidden from anyone who cannot raise a DR. */
  canCreateDr: boolean
}): (uds: Uds) => { next: StepAction | null; alt: StepAction | null } {
  const ASSESS: StepAction = {
    label: 'Assess',
    className: 'bg-green-50 text-green-700 hover:bg-green-100',
    run: handlers.assess,
  }
  // Scenario 72 Part 7 — both of these legs now go out on a Delivery Receipt:
  // the buttons open a new DR for this ticket instead of a modal.
  const DISPATCH: StepAction = {
    label: 'DR to Service Center',
    className: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
    run: handlers.dispatch,
  }
  const RECEIVE: StepAction = {
    label: 'Receive Back',
    className: 'bg-teal-50 text-teal-700 hover:bg-teal-100',
    run: handlers.receive,
  }
  const RELEASE: StepAction = {
    label: 'DR to Customer',
    className: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    run: handlers.release,
  }
  const dispatchStep = handlers.canCreateDr ? DISPATCH : null
  const releaseStep = handlers.canCreateDr ? RELEASE : null
  const WRITE_OFF: StepAction = {
    label: 'Write Off',
    className: 'bg-red-50 text-red-700 hover:bg-red-100',
    run: handlers.writeOff,
  }
  const stepTo = (label: string, target: ManualUdsStatus): StepAction => ({
    label,
    className: 'bg-prominent-purple-50 text-prominent-purple-700 hover:bg-prominent-purple-100',
    run: (uds) => handlers.advance(uds, target),
  })
  // Scenario 72 Part 10 — the ticket's own transfer moves it: its dispatch and
  // receipt are the trip to main (and, repaired, the trip home).
  const onTransfer = (transfer: Uds['linkedStockTransfer']): StepAction | null =>
    transfer && transfer.status !== 'cancelled' && transfer.status !== 'rejected'
      ? {
          label: `Open ${transfer.transferNumber}`,
          className: 'bg-sky-50 text-sky-700 hover:bg-sky-100',
          run: () => handlers.viewTransfer(transfer.transferNumber),
        }
      : null

  return (uds) => {
    const none = { next: null, alt: null }
    if (uds.status === 'completed' || uds.status === 'cancelled') return none

    // Already raised: the DR (draft or awaiting approval) moves the sheet
    // once it posts, so the step is to open it, not to raise another.
    const openDr = uds.deliveryReceipts?.[0]
    if (openDr) {
      const waiting = openDr.status === 'draft' ? 'draft' : 'awaiting approval'
      return {
        next: {
          label: `Open ${openDr.drNumber} (${waiting})`,
          className: 'bg-sky-50 text-sky-700 hover:bg-sky-100',
          run: () => handlers.viewDr(openDr.id),
        },
        alt: null,
      }
    }

    // Scenario 73 — Home Service: the service center named at intake already
    // serviced the unit, so it goes straight back to the customer on a DR —
    // no trip to main, no assess, no dispatch.
    if (uds.repairType === 'home_service' && uds.customerId && uds.status !== 'at_provider') {
      return { next: releaseStep, alt: null }
    }

    // Maintenance, quality check, pull-out and loan never travel to main.
    if (uds.reason !== 'repair' && uds.status === 'issued') {
      return { next: stepTo('Complete', 'completed'), alt: null }
    }

    const outbound = onTransfer(uds.linkedStockTransfer)
    if (uds.status === 'issued') {
      const send: StepAction = { ...stepTo('Send to Main', 'in_transit'), run: handlers.sendToMain }
      return { next: outbound ?? send, alt: null }
    }
    if (uds.status === 'in_transit') {
      return { next: outbound ?? stepTo('Receive at Main', 'received'), alt: null }
    }
    if (uds.status === 'at_provider') return { next: RECEIVE, alt: null }

    // Custodial sheets close only through the release, which is what issues
    // the DR and returns the serial to `sold`. Our own repaired unit goes home
    // on its return transfer; without one (already at its branch), Complete.
    const close = uds.customerId
      ? releaseStep
      : (onTransfer(uds.returnStockTransfer ?? null) ?? stepTo('Complete', 'completed'))

    if (uds.status === 'repaired') return { next: close, alt: null }

    // received
    if (uds.reason === 'repair' && !uds.assessment) return { next: ASSESS, alt: null }
    if (uds.assessment === 'repairable') return { next: dispatchStep, alt: null }
    if (uds.assessment === 'unrepairable') {
      // The only genuine fork: the customer can collect the dead unit, or we
      // scrap it. Both are valid endings, so neither can be the sole button.
      const canWriteOff = !uds.writeOffAdjustmentId
      if (uds.customerId) return { next: releaseStep, alt: canWriteOff ? WRITE_OFF : null }
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
    statusCounts,
    statusFilter,
    reasonFilter,
    warehouseFilter,
    providerFilter,
    setStatusFilter,
    setReasonFilter,
    setWarehouseFilter,
    setProviderFilter,
    resetFilters,
    page,
    setPage,
    limit,
    setLimit,
    warehouseOptions,
    supplierOptions,
    createUds,
    isCreating,
    updateStatus,
    isUpdatingStatus,
    assessUds,
    isAssessing,
    receiveFromProvider,
    isReceivingFromProvider,
    setRepairProvider,
    isSettingRepairProvider,
    writeOffUds,
    isWritingOff,
  } = useUdsManager()

  const [isCreateOpen, setCreateOpen] = useState(false)
  const [selectedStep, setSelectedStep] = useState<{
    uds: Uds
    target: ManualUdsStatus
  } | null>(null)
  const [viewUds, setViewUds] = useState<Uds | null>(null)
  const [assessingUds, setAssessingUds] = useState<Uds | null>(null)
  const [settingProviderUds, setSettingProviderUds] = useState<Uds | null>(null)
  const [writingOffUds, setWritingOffUds] = useState<Uds | null>(null)
  const [receivingUds, setReceivingUds] = useState<Uds | null>(null)
  const router = useRouter()
  const canCreateDr = can(session, INVENTORY_PERMISSIONS.DELIVERY_RECEIPTS_CREATE)
  const canCreateTransfer = can(session, INVENTORY_PERMISSIONS.TRANSFERS_CREATE)
  // Whoever can dispatch sends the unit straight away; anyone else requests.
  const canDispatchTransfer = can(session, INVENTORY_PERMISSIONS.TRANSFERS_DISPATCH)
  const canCreateRr = can(session, INVENTORY_PERMISSIONS.RECEIVE_CREATE)

  // Built once from the setters above; the table itself is state-independent.
  const nextStep = useMemo(
    () =>
      buildNextStep({
        assess: setAssessingUds,
        dispatch: (uds) =>
          router.push(`/inventory/delivery-receipts/new?purpose=to_service_center&udsId=${uds.id}`),
        receive: (uds) => {
          // Back from the service center on a Receiving Report, which closes
          // the ticket's leg. Without RR rights, the old confirmation.
          if (!canCreateRr || !uds.repairProviderId) return setReceivingUds(uds)
          const serials = uds.lines.map((l) => l.serialNumberId).join(',')
          router.push(
            `/inventory/stock-transaction?tab=receiving&new=1&serviceCenter=${uds.repairProviderId}&serials=${serials}`
          )
        },
        release: (uds) => {
          const purpose =
            uds.status === 'repaired' || uds.repairType === 'home_service'
              ? 'repaired_to_customer'
              : 'unrepaired_to_customer'
          router.push(`/inventory/delivery-receipts/new?purpose=${purpose}&udsId=${uds.id}`)
        },
        writeOff: setWritingOffUds,
        advance: (uds, target) => setSelectedStep({ uds, target }),
        sendToMain: (uds) => {
          // The transfer to main becomes the ticket's own (the backend links
          // it), so its dispatch and receipt move the ticket.
          if (!canCreateTransfer || !uds.warehouseId) {
            return setSelectedStep({ uds, target: 'in_transit' })
          }
          saveStockTransferDraft(
            {
              fromWarehouseId: uds.warehouseId,
              pinnedLines: uds.lines.map((l) => ({
                itemId: l.itemId,
                itemLabel: l.item.name,
                serialNumberId: l.serialNumberId,
              })),
              toMain: true,
              reason: `Repair — ${uds.code} to Main for assessment`,
              dispatchNow: canDispatchTransfer,
            },
            session.id
          )
          router.push('/inventory/stock-transaction?tab=transfers')
        },
        viewTransfer: (number) =>
          router.push(
            `/inventory/stock-transaction?tab=transfers&transfer=${encodeURIComponent(number)}`
          ),
        viewDr: (id) => router.push(`/inventory/delivery-receipts/${id}`),
        canCreateDr,
      }),
    [router, canCreateDr, canCreateTransfer, canDispatchTransfer, canCreateRr, session.id]
  )

  const hasFilters = !!statusFilter || !!reasonFilter || !!warehouseFilter || !!providerFilter

  async function handleUpdateStatus(data: UpdateUdsStatusFormValues) {
    if (!selectedStep) return { success: false, error: 'No UDS selected', message: '' }
    return updateStatus(selectedStep.uds.id, data)
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

  async function handleReceiveFromProvider(data: ReceiveFromProviderFormValues) {
    if (!receivingUds) return { success: false, error: 'No UDS selected', message: '' }
    return receiveFromProvider(receivingUds.id, data)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
      <div className="mx-auto max-w-[1520px] space-y-6">
        {/* Same header chrome as Stock Returns and Stock Transfers — these
            three inventory movement screens share one surface. */}
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-[21px] font-semibold tracking-[-0.015em]">Unit Document Sheets</h1>
            <p className="text-[13px] text-[#4b4b5a]">
              Track units leaving the branch for repair, pull-out, maintenance, or loan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-[9px]">
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

          {/* Oct 29 UAT WH-05 — the repair tickets at one branch. Each branch
              has one warehouse, so it's labelled by the branch. */}
          <SearchableSelect
            value={warehouseFilter ?? ''}
            onChange={(v) => setWarehouseFilter(v || undefined)}
            options={warehouseOptions.map((w) => ({
              value: w.id,
              label: w.branch?.name ?? w.name,
            }))}
            placeholder="All branches"
            ariaLabel="Branch"
            className="w-56"
          />

          {/* Scenario 73 — the tickets one service center has, or had. */}
          <SearchableSelect
            value={providerFilter ?? ''}
            onChange={(v) => setProviderFilter(v || undefined)}
            options={supplierOptions.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="All service centers"
            ariaLabel="Service center"
            className="w-64"
          />

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
                  <tr className="border-b border-[#eeeef1] bg-[#fbfbfc]">
                    <th className={`px-4 py-3 text-left ${STOCK_TABLE_HEAD}`}>Document</th>
                    <th className={`px-4 py-3 text-left ${STOCK_TABLE_HEAD}`}>Status</th>
                    <th className={`px-4 py-3 text-left ${STOCK_TABLE_HEAD}`}>
                      Units / Service Center
                    </th>
                    <th className={`px-4 py-3 text-left ${STOCK_TABLE_HEAD}`}>Route</th>
                    <th className={`hidden px-4 py-3 text-left md:table-cell ${STOCK_TABLE_HEAD}`}>
                      Latest document
                    </th>
                    <th className={`hidden px-4 py-3 text-left sm:table-cell ${STOCK_TABLE_HEAD}`}>
                      Issued
                    </th>
                    <th className={`px-4 py-3 text-right ${STOCK_TABLE_HEAD}`}>Actions</th>
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
                              {uds.repairType === 'home_service' && (
                                <span className="text-zinc-500"> · Home Service</span>
                              )}
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
                              href={`/inventory/stock-transaction?tab=transfers&transfer=${encodeURIComponent(uds.linkedStockTransfer.transferNumber)}`}
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
                          {formatManilaDate(uds.createdAt, {
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
                                  setSelectedStep({ uds, target: 'cancelled' })
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
          {!isLoading && records.length > 0 && (
            <ListFooterPager
              page={page}
              pageCount={pagination.lastPage}
              total={pagination.total}
              limit={limit}
              noun="UDS records"
              onPageChange={setPage}
              onLimitChange={setLimit}
            />
          )}
        </div>
      </div>

      <CreateUdsModal
        isOpen={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={createUds}
        isSubmitting={isCreating}
        warehouseOptions={warehouseOptions}
        supplierOptions={supplierOptions}
        currentUserBranchId={session.branchId}
      />

      {selectedStep && (
        <UpdateUdsStatusModal
          isOpen={!!selectedStep}
          onClose={() => setSelectedStep(null)}
          onSubmit={handleUpdateStatus}
          isSubmitting={isUpdatingStatus}
          target={selectedStep.target}
          udsCode={selectedStep.uds.code}
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
        nextStep={(() => {
          const step = viewUds ? nextStep(viewUds).next : null
          return step && viewUds
            ? {
                label: step.label,
                run: () => {
                  setViewUds(null)
                  step.run(viewUds)
                },
              }
            : null
        })()}
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

      <ReceiveFromProviderModal
        uds={receivingUds}
        isOpen={!!receivingUds}
        onClose={() => setReceivingUds(null)}
        onSubmit={handleReceiveFromProvider}
        isSubmitting={isReceivingFromProvider}
      />
    </div>
  )
}
