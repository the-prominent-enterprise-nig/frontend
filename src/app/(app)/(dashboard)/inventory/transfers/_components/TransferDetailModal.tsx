'use client'

import { useState } from 'react'
import { useForm, useFieldArray, Controller, type Control } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import {
  X,
  Loader2,
  ArrowRight,
  CheckCircle,
  Truck,
  Clock,
  XCircle,
  Printer,
  Inbox,
  Hourglass,
  Ban,
  Receipt,
  UserCheck,
  AlertTriangle,
} from 'lucide-react'
import {
  DispatchTransferFormSchema,
  DispatchTransferFormValues,
  ReceiveTransferFormSchema,
  ReceiveTransferFormValues,
  RejectHqTransferFormSchema,
  RejectHqTransferFormValues,
  RejectTransferFormSchema,
  RejectTransferFormValues,
  RejectManagerTransferFormSchema,
  RejectManagerTransferFormValues,
  TransferSummary,
} from '@/src/schema/inventory/transfers'
import type { ApiResponse } from '@/src/libs/api/client'
import { getTransferDocument } from '../_actions/get-transfer-document'
import {
  printInventoryDocument,
  type PrintDocumentEnvelope,
} from '@/src/libs/print/printInventoryDocument'
import { QtyVarianceBadge } from '@/src/components/ui/QtyVarianceBadge'
import { ItemSearchCombobox } from '../../purchase-requests/_components/ItemSearchCombobox'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'
import { SerialSearchCombobox } from './SerialSearchCombobox'

const STATUS_CONFIG = {
  pending_manager_approval: {
    label: 'Pending',
    color: 'bg-indigo-100 text-indigo-700',
    icon: UserCheck,
  },
  requested: { label: 'Requested', color: 'bg-purple-100 text-purple-700', icon: Inbox },
  pending_hq_approval: {
    label: 'Pending HQ Approval',
    color: 'bg-amber-100 text-amber-700',
    icon: Hourglass,
  },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-600', icon: Ban },
  draft: { label: 'Accepted', color: 'bg-zinc-100 text-zinc-600', icon: Clock },
  in_transit: { label: 'In Transit', color: 'bg-blue-100 text-blue-700', icon: Truck },
  received: { label: 'Received', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  partially_received: {
    label: 'Partially Received',
    color: 'bg-amber-100 text-amber-700',
    icon: AlertTriangle,
  },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-600', icon: XCircle },
}

// A request can be withdrawn any time before physical movement starts
// (dispatch) — whether or not it's still waiting on manager or HQ approval.
const CANCELLABLE_STATUSES = new Set([
  'pending_manager_approval',
  'requested',
  'pending_hq_approval',
  'draft',
])

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateOnly(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Each branch has exactly one warehouse, so a transfer's fromWarehouse/
// toWarehouse is really a branch — display the branch's own name rather than
// the warehouse's auto-generated "{branch} Warehouse" name.
function branchLabel(
  wh: { name: string; branch?: { name: string } | null } | null | undefined,
  fallback = '—'
): string {
  return wh?.branch?.name ?? wh?.name ?? fallback
}

// One row per serial-tracked line being dispatched — the person dispatching
// physically has the stock in front of them, so this fetches in-stock
// serials live, scoped to that item + the source warehouse, and lets them
// pick the exact unit being sent. Distinct from CreateTransferModal's old
// (removed) serial picker: that ran at request time, before the requester
// could possibly know what's on the shelf at the other branch.
function DispatchSerialAssignmentRow({
  control,
  index,
  fromWarehouseId,
  itemId,
  itemLabel,
  error,
}: {
  control: Control<DispatchTransferFormValues>
  index: number
  fromWarehouseId: string | undefined
  itemId: string | undefined
  itemLabel: string | undefined
  error?: string
}) {
  const serialsQuery = useQuery({
    queryKey: ['inventory-serials-in-stock', fromWarehouseId, itemId],
    queryFn: () =>
      getSerialNumbers({
        warehouseId: fromWarehouseId,
        itemId,
        status: 'in_stock',
        limit: 500,
      }),
    enabled: !!fromWarehouseId && !!itemId,
    staleTime: 30 * 1000,
  })
  const serialOptions = serialsQuery.data?.data?.data ?? []

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600">
        {itemLabel ?? 'Item'} <span className="text-red-500">*</span>
      </label>
      <Controller
        name={`serialAssignments.${index}.serialNumberId`}
        control={control}
        render={({ field: f }) => (
          <SerialSearchCombobox
            value={f.value ?? ''}
            onChange={f.onChange}
            options={serialOptions}
            queryKey={`dispatch-serial-search-${fromWarehouseId}-${itemId}`}
            disabled={serialsQuery.isLoading}
            placeholder={serialsQuery.isLoading ? 'Loading serials…' : 'Search serial number…'}
            error={error}
          />
        )}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <p className="mt-0.5 text-zinc-800">{value}</p>
    </div>
  )
}

function renderTransferBody(doc: PrintDocumentEnvelope): string {
  const d = doc.document as Record<string, unknown>
  const lines = (d.lines as Array<Record<string, unknown>>) ?? []
  const hasSerialLine = lines.some((l) => (l.serialNumber as Record<string, unknown>)?.serialNumber)
  const linesHtml = lines
    .map((l) => {
      const serial = (l.serialNumber as Record<string, unknown>)?.serialNumber
      const serialCell = hasSerialLine ? `<td>${serial ?? '—'}</td>` : ''
      return `<tr><td>${(l.item as Record<string, unknown>)?.name ?? l.itemId ?? '—'}</td>${serialCell}<td style="text-align:right">${l.quantity}</td></tr>`
    })
    .join('')

  const driverFields: string[] = []
  if (d.driverName)
    driverFields.push(`<div><p class="label">Driver</p><p>${d.driverName}</p></div>`)
  if (d.driverPhone)
    driverFields.push(`<div><p class="label">Phone</p><p>${d.driverPhone}</p></div>`)
  if (d.driverLicense)
    driverFields.push(`<div><p class="label">License</p><p>${d.driverLicense}</p></div>`)
  if (d.vehiclePlate)
    driverFields.push(`<div><p class="label">Plate</p><p>${d.vehiclePlate}</p></div>`)
  if (d.carrierName)
    driverFields.push(`<div><p class="label">Carrier</p><p>${d.carrierName}</p></div>`)

  return `${driverFields.length > 0 ? `<h2>Logistics</h2><div class="meta">${driverFields.join('')}</div>` : ''}
    <h2>Items</h2>
    <table>
      <thead><tr><th>Item</th>${hasSerialLine ? '<th>Serial</th>' : ''}<th style="text-align:right">Qty</th></tr></thead>
      <tbody>${linesHtml}</tbody>
    </table>`
}

function printTransferDocument(data: unknown) {
  printInventoryDocument(data, 'Stock Transfer', renderTransferBody)
}

type Props = {
  transfer: TransferSummary | null
  isLoading: boolean
  isOpen: boolean
  onClose: () => void
  // Raw permission grants — combined with `currentUserBranchId` below into
  // per-transfer scoped flags, since a Branch Manager can hold e.g. the
  // "accept" permission in general but this specific transfer's source
  // warehouse may belong to a different branch than theirs.
  canAccept: boolean
  canReject: boolean
  canDispatch: boolean
  canReceive: boolean
  canHqApprove: boolean
  canHqReject: boolean
  canManagerApprove: boolean
  canManagerReject: boolean
  currentUserBranchId?: string | null
  // The region of the caller's own branch — drives whether they can act on
  // a transfer touching a real standalone warehouse (branchId: null,
  // Scenario 27), which exact branch-ownership can never match. null/
  // undefined for an unrestricted caller, or a branch with no region set.
  currentUserRegion?: string | null
  onAccept: (id: string) => Promise<ApiResponse<unknown>>
  onReject: (id: string, data: RejectTransferFormValues) => Promise<ApiResponse<unknown>>
  onDispatch: (id: string, data?: DispatchTransferFormValues) => Promise<ApiResponse<unknown>>
  onReceive: (id: string, data: ReceiveTransferFormValues) => Promise<ApiResponse<unknown>>
  onCancel: (id: string) => Promise<ApiResponse<unknown>>
  onApproveHq: (id: string) => Promise<ApiResponse<unknown>>
  onRejectHq: (id: string, data: RejectHqTransferFormValues) => Promise<ApiResponse<unknown>>
  onApproveManager: (id: string) => Promise<ApiResponse<unknown>>
  onRejectManager: (
    id: string,
    data: RejectManagerTransferFormValues
  ) => Promise<ApiResponse<unknown>>
  isAccepting: boolean
  isRejecting: boolean
  isDispatching: boolean
  isReceiving: boolean
  isCancelling: boolean
  isApprovingHq: boolean
  isRejectingHq: boolean
  isApprovingManager: boolean
  isRejectingManager: boolean
}

export default function TransferDetailModal({
  transfer,
  isLoading,
  isOpen,
  onClose,
  canAccept,
  canReject,
  canDispatch,
  canReceive,
  canHqApprove,
  canHqReject,
  canManagerApprove,
  canManagerReject,
  currentUserBranchId,
  currentUserRegion,
  onAccept,
  onReject,
  onDispatch,
  onReceive,
  onCancel,
  onApproveHq,
  onRejectHq,
  onApproveManager,
  onRejectManager,
  isAccepting,
  isRejecting,
  isDispatching,
  isReceiving,
  isCancelling,
  isApprovingHq,
  isRejectingHq,
  isApprovingManager,
  isRejectingManager,
}: Props) {
  const [showDispatchForm, setShowDispatchForm] = useState(false)
  const [showReceiveForm, setShowReceiveForm] = useState(false)
  const [showRejectHqForm, setShowRejectHqForm] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [showRejectManagerForm, setShowRejectManagerForm] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  // All optional fields default to '' (not undefined) so their inputs stay
  // controlled from mount — React logs "changing an uncontrolled input to be
  // controlled" the instant a value goes from undefined to a typed string.
  // Normalized back to undefined at submit time in handleDispatchSubmit/
  // handleReceiveSubmit, mirroring CreateTransferModal's own fix for this.
  const dispatchForm = useForm<DispatchTransferFormValues>({
    resolver: zodResolver(DispatchTransferFormSchema),
    defaultValues: {
      expectedArrival: '',
      notes: '',
      serialAssignments: [],
      driverName: '',
      driverPhone: '',
      driverLicense: '',
      vehiclePlate: '',
      carrierName: '',
    },
  })
  const { fields: serialAssignmentFields } = useFieldArray({
    control: dispatchForm.control,
    name: 'serialAssignments',
  })

  const receiveForm = useForm<ReceiveTransferFormValues>({
    resolver: zodResolver(ReceiveTransferFormSchema),
    defaultValues: {
      receivedDate: new Date().toISOString().split('T')[0],
      notes: '',
      lines: [],
      extraLines: [],
    },
  })
  const { fields: receiveLineFields } = useFieldArray({
    control: receiveForm.control,
    name: 'lines',
  })
  const {
    fields: extraLineFields,
    append: appendExtraLine,
    remove: removeExtraLine,
  } = useFieldArray({
    control: receiveForm.control,
    name: 'extraLines',
  })

  const rejectHqForm = useForm<RejectHqTransferFormValues>({
    resolver: zodResolver(RejectHqTransferFormSchema),
    defaultValues: { reason: '' },
  })

  const rejectForm = useForm<RejectTransferFormValues>({
    resolver: zodResolver(RejectTransferFormSchema),
    defaultValues: { reason: '' },
  })

  const rejectManagerForm = useForm<RejectManagerTransferFormValues>({
    resolver: zodResolver(RejectManagerTransferFormSchema),
    defaultValues: { reason: '' },
  })

  if (!isOpen) return null

  const status = transfer?.status ?? 'draft'
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  const StatusIcon = statusCfg.icon

  // A permission like "accept" is granted at the role level, but accept/
  // reject/dispatch are source-branch-only and receive is destination-
  // branch-only on the backend — so the permission alone isn't enough to
  // decide whether THIS transfer is actually theirs to act on. head office /
  // Business Owner (currentUserBranchId null) stays unrestricted.
  // A real standalone warehouse (branchId: null — Scenario 27, ported from
  // Warehouse Request) falls back to region match instead of exact branch
  // ownership, since ownership can never be satisfied for one.
  const inScope = (warehouseBranchId: string | null | undefined, warehouseRegion?: string | null) =>
    !currentUserBranchId ||
    warehouseBranchId === currentUserBranchId ||
    (warehouseBranchId === null && warehouseRegion === currentUserRegion)
  const canAcceptThis =
    canAccept && inScope(transfer?.fromWarehouse?.branchId, transfer?.fromWarehouse?.region)
  const canRejectThis =
    canReject && inScope(transfer?.fromWarehouse?.branchId, transfer?.fromWarehouse?.region)
  const canDispatchThis =
    canDispatch && inScope(transfer?.fromWarehouse?.branchId, transfer?.fromWarehouse?.region)
  const canReceiveThis =
    canReceive && inScope(transfer?.toWarehouse?.branchId, transfer?.toWarehouse?.region)
  // Manager approval is scoped to the TO warehouse's branch too — it's the
  // requester's own branch manager signing off, same direction as receive.
  const canManagerApproveThis =
    canManagerApprove && inScope(transfer?.toWarehouse?.branchId, transfer?.toWarehouse?.region)
  const canManagerRejectThis =
    canManagerReject && inScope(transfer?.toWarehouse?.branchId, transfer?.toWarehouse?.region)
  // Cancelling withdraws YOUR OWN request — scoped to the requester's own
  // branch (TO warehouse), same direction as manager-approval above. The
  // source branch has its own dedicated decline path (Reject/Reject HQ),
  // which captures a reason, so it doesn't get a "Cancel" button here too.
  const canCancelThis =
    CANCELLABLE_STATUSES.has(status) &&
    inScope(transfer?.toWarehouse?.branchId, transfer?.toWarehouse?.region)

  // Only worth a column when at least one line actually carries a serial —
  // otherwise every row just shows a distracting "—".
  const hasSerialLine = !!transfer?.lines?.some((line) => line.serialNumber?.serialNumber)
  const isReceivedStatus = status === 'received' || status === 'partially_received'
  // Unlisted items received alongside the transfer — GoodsReceiptLines with
  // no stockTransferLineId, i.e. not one of the reconciled dispatched lines.
  // A reopened partially_received transfer issues its own separate GRN per
  // receive call, so there can be more than one — aggregate extras across
  // all of them, not just the first.
  const extraLinesReceived = (transfer?.goodsReceipts ?? []).flatMap((grn) => grn.lines ?? [])

  // A repair transfer auto-paired by the UDS module tracks its specific
  // serial separately (the UDS's own line) — never require an assignment
  // here for one of those, even for a serial-tracked line.
  const isUdsLinked = (transfer?.linkedUds?.length ?? 0) > 0

  function openDispatchForm() {
    if (!transfer) return
    const serialAssignments = isUdsLinked
      ? []
      : (transfer.lines ?? [])
          .filter((line) => line.item?.isSerialTracked)
          .map((line) => ({
            lineId: line.id ?? '',
            itemId: line.itemId ?? line.item?.id ?? '',
            itemLabel: line.item?.name,
            serialNumberId: '',
          }))
    dispatchForm.reset({
      expectedArrival: '',
      notes: '',
      serialAssignments,
      driverName: '',
      driverPhone: '',
      driverLicense: '',
      vehiclePlate: '',
      carrierName: '',
    })
    setShowDispatchForm(true)
  }

  async function handleDispatchSubmit(data: DispatchTransferFormValues) {
    if (!transfer) return
    const result = await onDispatch(transfer.id, {
      expectedArrival: data.expectedArrival,
      notes: data.notes || undefined,
      serialAssignments: data.serialAssignments?.length
        ? data.serialAssignments.map((a) => ({
            lineId: a.lineId,
            serialNumberId: a.serialNumberId,
          }))
        : undefined,
      driverName: data.driverName,
      driverPhone: data.driverPhone,
      driverLicense: data.driverLicense,
      vehiclePlate: data.vehiclePlate,
      carrierName: data.carrierName,
    })
    if (result.success) {
      setShowDispatchForm(false)
      dispatchForm.reset()
    }
  }

  function openReceiveForm() {
    if (!transfer) return
    // Only lines not yet at their full dispatched quantity are actionable —
    // on a first receive that's every line; on a reopened partially_received
    // transfer it's just what's still short. Default each to its full
    // remaining amount — the common case is everything arrived; the user
    // reduces the number or unchecks a serial only for the exceptional
    // shortfall.
    const outstanding = (transfer.lines ?? []).filter(
      (line) => Number(line.receivedQuantity ?? 0) < Number(line.quantity)
    )
    receiveForm.reset({
      receivedDate: new Date().toISOString().split('T')[0],
      notes: '',
      lines: outstanding.map((line) => ({
        stockTransferLineId: line.id ?? '',
        dispatchedQty: Number(line.quantity) - Number(line.receivedQuantity ?? 0),
        isSerial: !!line.serialNumberId,
        serialLabel: line.serialNumber?.serialNumber,
        itemLabel: line.item?.name ?? line.itemId ?? undefined,
        quantityReceived: Number(line.quantity) - Number(line.receivedQuantity ?? 0),
      })),
      extraLines: [],
    })
    setShowReceiveForm(true)
  }

  async function handleReceiveSubmit(data: ReceiveTransferFormValues) {
    if (!transfer) return
    const result = await onReceive(transfer.id, {
      ...data,
      notes: data.notes || undefined,
    })
    if (result.success) {
      setShowReceiveForm(false)
      receiveForm.reset()
    }
  }

  async function handleCancel() {
    if (!transfer) return
    await onCancel(transfer.id)
    setConfirmCancel(false)
  }

  async function handleApproveHq() {
    if (!transfer) return
    await onApproveHq(transfer.id)
  }

  async function handleAccept() {
    if (!transfer) return
    await onAccept(transfer.id)
  }

  async function handleRejectSubmit(data: RejectTransferFormValues) {
    if (!transfer) return
    const result = await onReject(transfer.id, data)
    if (result.success) {
      setShowRejectForm(false)
      rejectForm.reset()
    }
  }

  async function handleRejectHqSubmit(data: RejectHqTransferFormValues) {
    if (!transfer) return
    const result = await onRejectHq(transfer.id, data)
    if (result.success) {
      setShowRejectHqForm(false)
      rejectHqForm.reset()
    }
  }

  async function handleApproveManager() {
    if (!transfer) return
    await onApproveManager(transfer.id)
  }

  async function handleRejectManagerSubmit(data: RejectManagerTransferFormValues) {
    if (!transfer) return
    const result = await onRejectManager(transfer.id, data)
    if (result.success) {
      setShowRejectManagerForm(false)
      rejectManagerForm.reset()
    }
  }

  const fieldClass =
    'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Transfer Details</h2>
              {transfer && (
                <p className="mt-0.5 font-mono text-xs text-zinc-400">
                  {transfer.transferNumber
                    ? `${transfer.transferNumber} · #${transfer.id.slice(0, 8).toUpperCase()}`
                    : `#${transfer.id.slice(0, 8).toUpperCase()}`}
                </p>
              )}
            </div>
            {transfer && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusCfg.color}`}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {statusCfg.label}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading || !transfer ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <div className="space-y-5 px-6 py-5">
            {/* Route */}
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  From
                </p>
                <p className="mt-0.5 font-semibold text-zinc-900">
                  {branchLabel(transfer.fromWarehouse)}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-zinc-400" />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  To
                </p>
                <p className="mt-0.5 font-semibold text-zinc-900">
                  {branchLabel(transfer.toWarehouse)}
                </p>
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-medium text-zinc-400">Transfer Date</p>
                <p className="mt-0.5 text-zinc-900">{formatDateOnly(transfer.transferDate)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-400">Expected Arrival</p>
                <p className="mt-0.5 text-zinc-900">{formatDateOnly(transfer.expectedArrival)}</p>
              </div>
              {transfer.requestedByName && (
                <div>
                  <p className="text-xs font-medium text-zinc-400">Requested By</p>
                  <p className="mt-0.5 text-zinc-900">{transfer.requestedByName}</p>
                </div>
              )}
              {transfer.reason && (
                <div className="col-span-2">
                  <p className="text-xs font-medium text-zinc-400">Reason</p>
                  <p className="mt-0.5 text-zinc-900">{transfer.reason}</p>
                </div>
              )}
            </div>

            {/* Manager rejection reason (the requester's own branch manager
                declined it before it ever reached the source branch) */}
            {status === 'rejected' && transfer.managerRejectedReason && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">Rejected by Branch Manager</p>
                <p className="mt-1 text-sm text-red-700">{transfer.managerRejectedReason}</p>
                {transfer.managerActedByName && (
                  <p className="mt-1 text-xs text-red-500">
                    By {transfer.managerActedByName} on {formatDate(transfer.managerActedAt)}
                  </p>
                )}
              </div>
            )}

            {/* HQ rejection reason */}
            {status === 'rejected' && transfer.hqRejectedReason && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">Rejected at HQ</p>
                <p className="mt-1 text-sm text-red-700">{transfer.hqRejectedReason}</p>
                {transfer.hqActedByName && (
                  <p className="mt-1 text-xs text-red-500">
                    By {transfer.hqActedByName} on {formatDate(transfer.hqActedAt)}
                  </p>
                )}
              </div>
            )}

            {/* Source-branch rejection reason (distinct from an HQ rejection —
                the source branch declined it after HQ had already approved it,
                or it never needed HQ approval in the first place) */}
            {status === 'rejected' && transfer.branchRejectedReason && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">Rejected by Source Branch</p>
                <p className="mt-1 text-sm text-red-700">{transfer.branchRejectedReason}</p>
                {transfer.branchActedByName && (
                  <p className="mt-1 text-xs text-red-500">
                    By {transfer.branchActedByName} on {formatDate(transfer.branchActedAt)}
                  </p>
                )}
              </div>
            )}

            {/* Receiving report (GRN) — issued when the transfer is received
                (in full or in part) */}
            {(status === 'received' || status === 'partially_received') &&
              transfer.goodsReceipts &&
              transfer.goodsReceipts.length > 0 && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-green-800">
                    <Receipt className="h-4 w-4" />
                    {transfer.goodsReceipts.length > 1
                      ? 'Receiving Reports Issued'
                      : 'Receiving Report Issued'}
                  </p>
                  <div className="mt-1 space-y-0.5">
                    {transfer.goodsReceipts.map((grn) => (
                      <p key={grn.id} className="font-mono text-sm text-green-700">
                        {grn.code}
                      </p>
                    ))}
                  </div>
                  {extraLinesReceived.length > 0 && (
                    <div className="mt-3 border-t border-green-200 pt-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Unlisted Items Received
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {extraLinesReceived.map((line) => (
                          <li key={line.id} className="flex items-center justify-between text-sm">
                            <span className="text-zinc-700">
                              {line.item?.name ?? line.itemId}
                              {line.notes && (
                                <span className="ml-1.5 text-xs text-zinc-400">— {line.notes}</span>
                              )}
                            </span>
                            <span className="font-medium text-zinc-700">
                              +{line.quantityReceived}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

            {/* Logistics / Driver info (displayed when in_transit or received) */}
            {(status === 'in_transit' ||
              status === 'received' ||
              status === 'partially_received') &&
              (transfer.driverName || transfer.vehiclePlate || transfer.carrierName) && (
                <div>
                  <p className="mb-2 text-sm font-medium text-zinc-700">Logistics</p>
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                    {transfer.driverName && <InfoRow label="Driver" value={transfer.driverName} />}
                    {transfer.driverPhone && <InfoRow label="Phone" value={transfer.driverPhone} />}
                    {transfer.driverLicense && (
                      <InfoRow label="License" value={transfer.driverLicense} />
                    )}
                    {transfer.vehiclePlate && (
                      <InfoRow label="Plate" value={transfer.vehiclePlate} />
                    )}
                    {transfer.carrierName && (
                      <InfoRow label="Carrier" value={transfer.carrierName} />
                    )}
                  </div>
                </div>
              )}

            {/* Lines */}
            {transfer.lines && transfer.lines.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-zinc-700">Items</p>
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Item
                        </th>
                        {hasSerialLine && (
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Serial
                          </th>
                        )}
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Qty
                        </th>
                        {isReceivedStatus && (
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Received
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {transfer.lines.map((line, i) => (
                        <tr key={line.id ?? i}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-zinc-900">
                              {line.item?.name ?? line.itemId ?? '—'}
                            </p>
                            {line.item?.sku && (
                              <p className="font-mono text-xs text-zinc-400">{line.item.sku}</p>
                            )}
                          </td>
                          {hasSerialLine && (
                            <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                              {line.serialNumber?.serialNumber ?? '—'}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right font-medium text-zinc-700">
                            {line.quantity}
                          </td>
                          {isReceivedStatus && (
                            <td className="px-3 py-2 text-right">
                              {line.serialNumberId ? (
                                line.serialNumber?.status === 'lost_in_transit' ? (
                                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                    Lost in Transit
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                    Received
                                  </span>
                                )
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="font-medium text-zinc-700">
                                    {line.receivedQuantity ?? 0}
                                  </span>
                                  <QtyVarianceBadge
                                    ordered={line.quantity}
                                    received={line.receivedQuantity ?? 0}
                                  />
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Ledger timeline */}
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700">Movement Log</p>
              <ol className="space-y-2">
                <LedgerEvent
                  icon={<Inbox className="h-3.5 w-3.5" />}
                  label={
                    transfer.requestedByName
                      ? `Requested by ${transfer.requestedByName}`
                      : 'Request created'
                  }
                  timestamp={transfer.createdAt}
                  color="text-zinc-500 bg-zinc-100"
                />
                {status === 'pending_manager_approval' && (
                  <LedgerEvent
                    icon={<UserCheck className="h-3.5 w-3.5" />}
                    label="Pending branch manager approval"
                    timestamp={transfer.createdAt}
                    color="text-indigo-700 bg-indigo-100"
                  />
                )}
                {transfer.managerActedByName && status === 'rejected' && (
                  <LedgerEvent
                    icon={<Ban className="h-3.5 w-3.5" />}
                    label={`Rejected by branch manager — ${transfer.managerActedByName}`}
                    timestamp={transfer.managerActedAt}
                    color="text-red-600 bg-red-100"
                  />
                )}
                {transfer.managerActedByName &&
                  status !== 'rejected' &&
                  status !== 'pending_manager_approval' && (
                    <LedgerEvent
                      icon={<CheckCircle className="h-3.5 w-3.5" />}
                      label={`Approved by branch manager — ${transfer.managerActedByName}`}
                      timestamp={transfer.managerActedAt}
                      color="text-green-700 bg-green-100"
                    />
                  )}
                {status === 'pending_hq_approval' && (
                  <LedgerEvent
                    icon={<Hourglass className="h-3.5 w-3.5" />}
                    label="Pending head-office approval"
                    timestamp={transfer.createdAt}
                    color="text-amber-700 bg-amber-100"
                  />
                )}
                {transfer.hqActedByName && status === 'rejected' && (
                  <LedgerEvent
                    icon={<Ban className="h-3.5 w-3.5" />}
                    label={`Rejected at HQ by ${transfer.hqActedByName}`}
                    timestamp={transfer.hqActedAt}
                    color="text-red-600 bg-red-100"
                  />
                )}
                {transfer.hqActedByName &&
                  status !== 'rejected' &&
                  status !== 'pending_hq_approval' && (
                    <LedgerEvent
                      icon={<CheckCircle className="h-3.5 w-3.5" />}
                      label={`Approved at HQ by ${transfer.hqActedByName}`}
                      timestamp={transfer.hqActedAt}
                      color="text-green-700 bg-green-100"
                    />
                  )}
                {transfer.branchActedByName && status === 'rejected' && (
                  <LedgerEvent
                    icon={<Ban className="h-3.5 w-3.5" />}
                    label={`Rejected by source branch — ${transfer.branchActedByName}`}
                    timestamp={transfer.branchActedAt}
                    color="text-red-600 bg-red-100"
                  />
                )}
                {transfer.acceptedByName && (
                  <LedgerEvent
                    icon={<CheckCircle className="h-3.5 w-3.5" />}
                    label={`Accepted by source branch — ${transfer.acceptedByName}`}
                    timestamp={transfer.acceptedAt}
                    color="text-green-700 bg-green-100"
                  />
                )}
                {(status === 'in_transit' || isReceivedStatus) && (
                  <LedgerEvent
                    icon={<Truck className="h-3.5 w-3.5" />}
                    label={`Dispatched — stock deducted from ${branchLabel(transfer.fromWarehouse, 'source')}`}
                    timestamp={transfer.dispatchedAt ?? transfer.transferDate}
                    color="text-blue-700 bg-blue-100"
                  />
                )}
                {status === 'received' && (
                  <LedgerEvent
                    icon={<CheckCircle className="h-3.5 w-3.5" />}
                    label={`Received — stock added to ${branchLabel(transfer.toWarehouse, 'destination')}`}
                    timestamp={transfer.receivedAt}
                    color="text-green-700 bg-green-100"
                  />
                )}
                {status === 'partially_received' && (
                  <LedgerEvent
                    icon={<AlertTriangle className="h-3.5 w-3.5" />}
                    label="Partially received — see item table for shortfalls"
                    timestamp={transfer.receivedAt}
                    color="text-amber-700 bg-amber-100"
                  />
                )}
                {status === 'cancelled' && (
                  <LedgerEvent
                    icon={<XCircle className="h-3.5 w-3.5" />}
                    label="Transfer cancelled — no ledger entries written"
                    timestamp={transfer.cancelledAt}
                    color="text-red-600 bg-red-100"
                  />
                )}
              </ol>
            </div>

            {/* Dispatch form (inline) */}
            {showDispatchForm && (
              <form
                onSubmit={dispatchForm.handleSubmit(handleDispatchSubmit)}
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3"
              >
                <p className="text-sm font-medium text-zinc-700">Dispatch Transfer</p>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Expected Arrival <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="expectedArrival"
                    control={dispatchForm.control}
                    render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Notes</label>
                  <Controller
                    name="notes"
                    control={dispatchForm.control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        placeholder="Optional dispatch notes…"
                        className={fieldClass}
                      />
                    )}
                  />
                </div>

                {serialAssignmentFields.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Assign Serial Numbers
                    </p>
                    <p className="mb-2 text-xs text-zinc-500">
                      Pick the exact unit being sent for each serial-tracked item — the requester
                      couldn&apos;t know what&apos;s on your shelf, so it&apos;s chosen here.
                    </p>
                    <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3">
                      {serialAssignmentFields.map((f, idx) => (
                        <DispatchSerialAssignmentRow
                          key={f.id}
                          control={dispatchForm.control}
                          index={idx}
                          fromWarehouseId={transfer?.fromWarehouse?.id}
                          itemId={f.itemId}
                          itemLabel={f.itemLabel}
                          error={
                            dispatchForm.formState.errors.serialAssignments?.[idx]?.serialNumberId
                              ?.message
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Logistics / Driver
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">
                      Driver Name <span className="text-red-500">*</span>
                    </label>
                    <Controller
                      name="driverName"
                      control={dispatchForm.control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="text"
                          placeholder="e.g. Juan dela Cruz"
                          className={fieldClass}
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">
                      Driver Phone <span className="text-red-500">*</span>
                    </label>
                    <Controller
                      name="driverPhone"
                      control={dispatchForm.control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="text"
                          placeholder="e.g. 09171234567"
                          className={fieldClass}
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">
                      Driver License <span className="text-red-500">*</span>
                    </label>
                    <Controller
                      name="driverLicense"
                      control={dispatchForm.control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="text"
                          placeholder="License number"
                          className={fieldClass}
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">
                      Vehicle Plate <span className="text-red-500">*</span>
                    </label>
                    <Controller
                      name="vehiclePlate"
                      control={dispatchForm.control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="text"
                          placeholder="e.g. ABC 1234"
                          className={fieldClass}
                        />
                      )}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Carrier / Logistics Company <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="carrierName"
                    control={dispatchForm.control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        placeholder="e.g. LBC Express"
                        className={fieldClass}
                      />
                    )}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDispatchForm(false)
                      dispatchForm.reset()
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isDispatching}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {isDispatching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirm Dispatch
                  </button>
                </div>
              </form>
            )}

            {/* Receive form (inline) */}
            {showReceiveForm && (
              <form
                onSubmit={receiveForm.handleSubmit(handleReceiveSubmit)}
                className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3"
              >
                <p className="text-sm font-medium text-zinc-700">
                  {status === 'partially_received' ? 'Continue Receiving' : 'Confirm Receipt'}
                </p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Received Date <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="receivedDate"
                    control={receiveForm.control}
                    render={({ field }) => <input {...field} type="date" className={fieldClass} />}
                  />
                  {receiveForm.formState.errors.receivedDate && (
                    <p className="mt-1 text-xs text-red-600">
                      {receiveForm.formState.errors.receivedDate.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Items Received
                  </label>
                  <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
                    {receiveLineFields.map((lineField, idx) => (
                      <div
                        key={lineField.id}
                        className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-2 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-800">
                            {lineField.itemLabel ?? '—'}
                          </p>
                          <p className="truncate text-xs text-zinc-400">
                            {lineField.isSerial
                              ? (lineField.serialLabel ?? '—')
                              : `Remaining: ${lineField.dispatchedQty}`}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {lineField.isSerial ? (
                            <Controller
                              name={`lines.${idx}.quantityReceived`}
                              control={receiveForm.control}
                              render={({ field }) => (
                                <label className="flex items-center gap-1.5 text-sm text-zinc-600">
                                  <input
                                    type="checkbox"
                                    checked={field.value === 1}
                                    onChange={(e) => field.onChange(e.target.checked ? 1 : 0)}
                                    className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500"
                                  />
                                  Received
                                </label>
                              )}
                            />
                          ) : (
                            <Controller
                              name={`lines.${idx}.quantityReceived`}
                              control={receiveForm.control}
                              render={({ field }) => (
                                <input
                                  type="number"
                                  min={0}
                                  max={lineField.dispatchedQty}
                                  // Number('') is 0, which would otherwise
                                  // snap the field straight back to "0" the
                                  // instant it's cleared — NaN lets it sit
                                  // visually blank while being edited.
                                  value={Number.isNaN(field.value) ? '' : field.value}
                                  onChange={(e) =>
                                    field.onChange(
                                      e.target.value === '' ? NaN : Number(e.target.value)
                                    )
                                  }
                                  onBlur={() => {
                                    if (Number.isNaN(field.value)) field.onChange(0)
                                  }}
                                  className="w-20 rounded-lg border border-zinc-200 px-2 py-1 text-right text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                                />
                              )}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {receiveForm.formState.errors.lines && (
                    <p className="mt-1 text-xs text-red-600">
                      Check the quantities above — some values are invalid.
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-xs font-medium text-zinc-600">
                      Unlisted Items{' '}
                      <span className="font-normal text-zinc-400">
                        (received but not on the transfer)
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => appendExtraLine({ itemId: '', quantity: 1, notes: '' })}
                      className="flex items-center gap-1 text-xs font-medium text-prominent-purple-700 hover:text-prominent-purple-800"
                    >
                      + Add unlisted item
                    </button>
                  </div>
                  {extraLineFields.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
                      {extraLineFields.map((extraField, idx) => (
                        <div
                          key={extraField.id}
                          className="flex items-center gap-2 border-b border-zinc-100 pb-2 last:border-0 last:pb-0"
                        >
                          <div className="min-w-0 flex-1">
                            <Controller
                              name={`extraLines.${idx}.itemId`}
                              control={receiveForm.control}
                              render={({ field }) => (
                                <ItemSearchCombobox
                                  value={field.value ?? ''}
                                  onChange={(id) => field.onChange(id)}
                                  error={
                                    receiveForm.formState.errors.extraLines?.[idx]?.itemId?.message
                                  }
                                />
                              )}
                            />
                          </div>
                          <Controller
                            name={`extraLines.${idx}.quantity`}
                            control={receiveForm.control}
                            render={({ field }) => (
                              <input
                                type="number"
                                min={0.01}
                                step="any"
                                value={Number.isNaN(field.value) ? '' : field.value}
                                onChange={(e) =>
                                  field.onChange(
                                    e.target.value === '' ? NaN : Number(e.target.value)
                                  )
                                }
                                onBlur={() => {
                                  if (Number.isNaN(field.value)) field.onChange(0)
                                }}
                                className="w-20 shrink-0 rounded-lg border border-zinc-200 px-2 py-1 text-right text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                              />
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => removeExtraLine(idx)}
                            className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="Remove unlisted item"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-1 text-xs text-zinc-400">
                    Serial-tracked items can&apos;t be added here — route those through the serial
                    numbers module.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Notes</label>
                  <Controller
                    name="notes"
                    control={receiveForm.control}
                    render={({ field }) => (
                      <input
                        {...field}
                        type="text"
                        placeholder="Optional receipt notes…"
                        className={fieldClass}
                      />
                    )}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReceiveForm(false)
                      receiveForm.reset()
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isReceiving}
                    className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {isReceiving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirm Receipt
                  </button>
                </div>
              </form>
            )}

            {/* Reject at HQ form (inline) */}
            {showRejectHqForm && (
              <form
                onSubmit={rejectHqForm.handleSubmit(handleRejectHqSubmit)}
                className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3"
              >
                <p className="text-sm font-medium text-red-800">Reject Request at HQ</p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="reason"
                    control={rejectHqForm.control}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        rows={3}
                        placeholder="Why is this request being rejected?"
                        className={`${fieldClass} resize-none bg-white`}
                      />
                    )}
                  />
                  {rejectHqForm.formState.errors.reason && (
                    <p className="mt-1 text-xs text-red-600">
                      {rejectHqForm.formState.errors.reason.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectHqForm(false)
                      rejectHqForm.reset()
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isRejectingHq}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {isRejectingHq && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirm Rejection
                  </button>
                </div>
              </form>
            )}

            {/* Reject (source branch) form (inline) */}
            {showRejectForm && (
              <form
                onSubmit={rejectForm.handleSubmit(handleRejectSubmit)}
                className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3"
              >
                <p className="text-sm font-medium text-red-800">Reject Incoming Request</p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="reason"
                    control={rejectForm.control}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        rows={3}
                        placeholder="Why is this request being rejected?"
                        className={`${fieldClass} resize-none bg-white`}
                      />
                    )}
                  />
                  {rejectForm.formState.errors.reason && (
                    <p className="mt-1 text-xs text-red-600">
                      {rejectForm.formState.errors.reason.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectForm(false)
                      rejectForm.reset()
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isRejecting}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {isRejecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirm Rejection
                  </button>
                </div>
              </form>
            )}

            {/* Reject (branch manager) form (inline) */}
            {showRejectManagerForm && (
              <form
                onSubmit={rejectManagerForm.handleSubmit(handleRejectManagerSubmit)}
                className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3"
              >
                <p className="text-sm font-medium text-red-800">Reject Request</p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <Controller
                    name="reason"
                    control={rejectManagerForm.control}
                    render={({ field }) => (
                      <textarea
                        {...field}
                        rows={3}
                        placeholder="Why is this request being rejected?"
                        className={`${fieldClass} resize-none bg-white`}
                      />
                    )}
                  />
                  {rejectManagerForm.formState.errors.reason && (
                    <p className="mt-1 text-xs text-red-600">
                      {rejectManagerForm.formState.errors.reason.message}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectManagerForm(false)
                      rejectManagerForm.reset()
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isRejectingManager}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {isRejectingManager && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirm Rejection
                  </button>
                </div>
              </form>
            )}

            {/* Cancel confirm */}
            {confirmCancel && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">Cancel this transfer?</p>
                <p className="mt-1 text-xs text-red-600">
                  No stock movements will be recorded. This cannot be undone.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(false)}
                    className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {isCancelling && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Yes, Cancel Transfer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer actions */}
        {transfer &&
          !showDispatchForm &&
          !showReceiveForm &&
          !showRejectHqForm &&
          !showRejectForm &&
          !showRejectManagerForm &&
          !confirmCancel && (
            <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4">
              <div>
                {canCancelThis && (
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Cancel Transfer
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                {(status === 'in_transit' || isReceivedStatus) && (
                  <button
                    type="button"
                    onClick={async () => {
                      setIsPrinting(true)
                      try {
                        const res = await getTransferDocument(transfer.id)
                        if (res.success && res.data) printTransferDocument(res.data)
                      } finally {
                        setIsPrinting(false)
                      }
                    }}
                    disabled={isPrinting}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-60"
                  >
                    {isPrinting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Printer className="h-3.5 w-3.5" />
                    )}
                    Print
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                >
                  Close
                </button>
                {status === 'draft' && canDispatchThis && (
                  <button
                    type="button"
                    onClick={openDispatchForm}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <Truck className="h-4 w-4" />
                    Dispatch
                  </button>
                )}
                {status === 'in_transit' && canReceiveThis && (
                  <button
                    type="button"
                    onClick={openReceiveForm}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Mark Received
                  </button>
                )}
                {status === 'partially_received' && canReceiveThis && (
                  <button
                    type="button"
                    onClick={openReceiveForm}
                    className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    Receive Remaining
                  </button>
                )}
                {status === 'pending_manager_approval' && canManagerRejectThis && (
                  <button
                    type="button"
                    onClick={() => setShowRejectManagerForm(true)}
                    className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <Ban className="h-4 w-4" />
                    Reject
                  </button>
                )}
                {status === 'pending_manager_approval' && canManagerApproveThis && (
                  <button
                    type="button"
                    onClick={handleApproveManager}
                    disabled={isApprovingManager}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {isApprovingManager ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Approve
                  </button>
                )}
                {status === 'pending_hq_approval' && canHqReject && (
                  <button
                    type="button"
                    onClick={() => setShowRejectHqForm(true)}
                    className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <Ban className="h-4 w-4" />
                    Reject
                  </button>
                )}
                {status === 'pending_hq_approval' && canHqApprove && (
                  <button
                    type="button"
                    onClick={handleApproveHq}
                    disabled={isApprovingHq}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {isApprovingHq ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Approve
                  </button>
                )}
                {status === 'requested' && canRejectThis && (
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(true)}
                    className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <Ban className="h-4 w-4" />
                    Reject
                  </button>
                )}
                {status === 'requested' && canAcceptThis && (
                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={isAccepting}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {isAccepting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    Accept
                  </button>
                )}
              </div>
            </div>
          )}
      </div>
    </div>
  )
}

function LedgerEvent({
  icon,
  label,
  timestamp,
  color,
}: {
  icon: React.ReactNode
  label: string
  timestamp?: string | null
  color: string
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color}`}
      >
        {icon}
      </span>
      <div>
        <p className="text-sm text-zinc-700">{label}</p>
        <p className="text-xs text-zinc-400">{formatDate(timestamp)}</p>
      </div>
    </li>
  )
}
