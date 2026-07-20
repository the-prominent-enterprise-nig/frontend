'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  X,
  Loader2,
  ArrowRight,
  Package,
  CheckCircle,
  Truck,
  Clock,
  XCircle,
  Printer,
} from 'lucide-react'
import {
  DispatchTransferFormSchema,
  DispatchTransferFormValues,
  ReceiveTransferFormSchema,
  ReceiveTransferFormValues,
  TransferSummary,
} from '@/src/schema/inventory/transfers'
import type { ApiResponse } from '@/src/libs/api/client'
import { getTransferDocument } from '../_actions/get-transfer-document'
import {
  printInventoryDocument,
  type PrintDocumentEnvelope,
} from '@/src/libs/print/printInventoryDocument'

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-zinc-100 text-zinc-600', icon: Clock },
  in_transit: { label: 'In Transit', color: 'bg-blue-100 text-blue-700', icon: Truck },
  received: { label: 'Received', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-600', icon: XCircle },
}

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
  const linesHtml = lines
    .map(
      (l) =>
        `<tr><td>${(l.item as Record<string, unknown>)?.name ?? l.itemId ?? '—'}</td><td style="text-align:right">${l.quantity}</td></tr>`
    )
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
      <thead><tr><th>Item</th><th style="text-align:right">Qty</th></tr></thead>
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
  canDispatch: boolean
  canReceive: boolean
  onDispatch: (id: string, data?: DispatchTransferFormValues) => Promise<ApiResponse<unknown>>
  onReceive: (id: string, data: ReceiveTransferFormValues) => Promise<ApiResponse<unknown>>
  onCancel: (id: string) => Promise<ApiResponse<unknown>>
  isDispatching: boolean
  isReceiving: boolean
  isCancelling: boolean
}

export default function TransferDetailModal({
  transfer,
  isLoading,
  isOpen,
  onClose,
  canDispatch,
  canReceive,
  onDispatch,
  onReceive,
  onCancel,
  isDispatching,
  isReceiving,
  isCancelling,
}: Props) {
  const [showDispatchForm, setShowDispatchForm] = useState(false)
  const [showReceiveForm, setShowReceiveForm] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  const dispatchForm = useForm<DispatchTransferFormValues>({
    resolver: zodResolver(DispatchTransferFormSchema),
    defaultValues: {},
  })

  const receiveForm = useForm<ReceiveTransferFormValues>({
    resolver: zodResolver(ReceiveTransferFormSchema),
    defaultValues: {
      receivedDate: new Date().toISOString().split('T')[0],
    },
  })

  if (!isOpen) return null

  const status = transfer?.status ?? 'draft'
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  const StatusIcon = statusCfg.icon

  async function handleDispatchSubmit(data: DispatchTransferFormValues) {
    if (!transfer) return
    const result = await onDispatch(transfer.id, data)
    if (result.success) {
      setShowDispatchForm(false)
      dispatchForm.reset()
    }
  }

  async function handleReceiveSubmit(data: ReceiveTransferFormValues) {
    if (!transfer) return
    const result = await onReceive(transfer.id, data)
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
                  {transfer.fromWarehouse?.name ?? '—'}
                </p>
                <p className="font-mono text-xs text-zinc-500">{transfer.fromWarehouse?.code}</p>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-zinc-400" />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  To
                </p>
                <p className="mt-0.5 font-semibold text-zinc-900">
                  {transfer.toWarehouse?.name ?? '—'}
                </p>
                <p className="font-mono text-xs text-zinc-500">{transfer.toWarehouse?.code}</p>
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
              {transfer.reason && (
                <div className="col-span-2">
                  <p className="text-xs font-medium text-zinc-400">Reason</p>
                  <p className="mt-0.5 text-zinc-900">{transfer.reason}</p>
                </div>
              )}
            </div>

            {/* Logistics / Driver info (displayed when in_transit or received) */}
            {(status === 'in_transit' || status === 'received') &&
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
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Qty
                        </th>
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
                          <td className="px-3 py-2 text-right font-medium text-zinc-700">
                            {line.quantity}
                          </td>
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
                  icon={<Package className="h-3.5 w-3.5" />}
                  label="Transfer created"
                  timestamp={transfer.createdAt}
                  color="text-zinc-500 bg-zinc-100"
                />
                {(status === 'in_transit' || status === 'received') && (
                  <LedgerEvent
                    icon={<Truck className="h-3.5 w-3.5" />}
                    label={`Dispatched — transfer_out recorded on ${transfer.fromWarehouse?.name ?? 'source'}`}
                    timestamp={transfer.dispatchedAt ?? transfer.transferDate}
                    color="text-blue-700 bg-blue-100"
                  />
                )}
                {status === 'received' && (
                  <LedgerEvent
                    icon={<CheckCircle className="h-3.5 w-3.5" />}
                    label={`Received — transfer_in recorded on ${transfer.toWarehouse?.name ?? 'destination'}`}
                    timestamp={transfer.receivedAt}
                    color="text-green-700 bg-green-100"
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
                    Expected Arrival
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

                <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Logistics / Driver (Optional)
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">
                      Driver Name
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
                      Driver Phone
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
                      Driver License
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
                      Vehicle Plate
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
                    Carrier / Logistics Company
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
                <p className="text-sm font-medium text-zinc-700">Confirm Receipt</p>
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
                    onClick={() => setShowReceiveForm(false)}
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
        {transfer && !showDispatchForm && !showReceiveForm && !confirmCancel && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4">
            <div>
              {status === 'draft' && (
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
              {(status === 'in_transit' || status === 'received') && (
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
              {status === 'draft' && canDispatch && (
                <button
                  type="button"
                  onClick={() => setShowDispatchForm(true)}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Truck className="h-4 w-4" />
                  Dispatch
                </button>
              )}
              {status === 'in_transit' && canReceive && (
                <button
                  type="button"
                  onClick={() => setShowReceiveForm(true)}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4" />
                  Mark Received
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
