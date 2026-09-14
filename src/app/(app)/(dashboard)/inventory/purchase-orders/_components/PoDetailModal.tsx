'use client'

import { useEffect, useState } from 'react'
import {
  X,
  CheckCircle,
  Ban,
  Send,
  PackagePlus,
  Archive,
  Pencil,
  Download,
  Receipt,
  FileText,
  Loader2,
} from 'lucide-react'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import { getPurchaseOrderReceipts } from '../_actions/get-purchase-order-receipts'
import { discountChainLabel } from '@/src/libs/format/discount-chain'
import { locationLabel } from '@/src/libs/format/locationLabel'
import {
  PLEX,
  MONO,
  StatusBadge,
  SupplierAvatar,
  fmtPeso,
  fmtDate,
  receiptTotals,
  daysLate,
  type PoStatus,
} from './procurementTokens'

type Props = {
  po: PurchaseOrderSummary | null
  onClose: () => void
  // Every action button here just hands the order back to the caller — the
  // caller already owns the confirm dialogs / full-screen forms these open
  // (CancelPoModal, ConfirmActionModal, ReceiveAgainstPoModal, CreatePoModal
  // in edit mode) and decides whether the current user may take each one;
  // when the matching `can*` flag is omitted (or false), the button doesn't
  // render at all rather than rendering disabled.
  canApprove?: boolean
  canCancel?: boolean
  canSend?: boolean
  canReceive?: boolean
  canClose?: boolean
  canEdit?: boolean
  canViewApBill?: boolean
  onApprove?: (po: PurchaseOrderSummary) => void
  onCancel?: (po: PurchaseOrderSummary) => void
  onSend?: (po: PurchaseOrderSummary) => void
  onReceive?: (po: PurchaseOrderSummary) => void
  /** Named distinctly from `onClose` (which dismisses this panel) — this one
   * closes the purchase order itself, settling it. */
  onCloseOrder?: (po: PurchaseOrderSummary) => void
  onEdit?: (po: PurchaseOrderSummary) => void
  onViewInvoice?: (po: PurchaseOrderSummary) => void
  onViewReceipts?: (po: PurchaseOrderSummary) => void
  onDownload?: (po: PurchaseOrderSummary) => void
  isDownloading?: boolean
}

// ─── Lifecycle trail ──────────────────────────────────────────────────────────
// A cancelled order is a terminal branch off draft/approved, not a step in
// this line, so it gets its own banner below instead of a stage here.

const STAGES: { key: string; label: string }[] = [
  { key: 'draft', label: 'Created' },
  { key: 'approved', label: 'Approved' },
  { key: 'sent', label: 'Sent' },
  { key: 'received', label: 'Received' },
  { key: 'closed', label: 'Closed' },
]

const STAGE_INDEX: Record<PoStatus, number> = {
  draft: 0,
  approved: 1,
  sent: 2,
  partially_received: 3,
  fully_received: 3,
  closed: 4,
  cancelled: 0,
}

/** The one line of detail under each stage — a date once it's happened, a
 * plain status word otherwise ("Not sent", "Open") so every stage always
 * has something below it, not just the ones already reached. */
function stageMeta(
  i: number,
  po: PurchaseOrderSummary,
  stageIndex: number,
  received: number,
  ordered: number
): string {
  if (i === 0) return fmtDate(po.createdAt)
  if (i === 1) return po.approvedByName ?? (stageIndex >= 1 ? 'Approved' : 'Pending')
  if (i === 2) return po.sentAt ? fmtDate(po.sentAt) : stageIndex >= 2 ? 'Sent' : 'Not sent'
  if (i === 3) return received > 0 ? `${received} of ${ordered} units` : 'Not started'
  return stageIndex === 4 ? 'Complete' : 'Open'
}

function InfoRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={`${MONO} text-[10px] uppercase tracking-[.09em] text-[#a3a3b2]`}>{label}</p>
      <p
        className={`mt-[3px] text-[13px] font-medium ${muted ? 'text-[#8b8b9b]' : 'text-[#17171c]'}`}
      >
        {value}
      </p>
    </div>
  )
}

function OutlineBtn({
  icon,
  label,
  onClick,
  disabled,
  tone = 'default',
}: {
  icon: React.ReactElement
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'red'
}): React.ReactElement {
  const toneClass =
    tone === 'red'
      ? 'border-[#f3c9c5] text-[#b42318] hover:bg-[#fdeceb]'
      : 'border-[#d3d3db] text-[#17171c] hover:border-[#a3a3b2] hover:bg-[#f6f6f8]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg border bg-white px-[13px] py-2 text-[13px] font-medium transition-colors disabled:opacity-50 ${toneClass}`}
    >
      {icon}
      {label}
    </button>
  )
}

function PrimaryBtn({
  icon,
  label,
  onClick,
  disabled,
  tone = 'purple',
}: {
  icon: React.ReactElement
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'purple' | 'green'
}): React.ReactElement {
  const toneClass =
    tone === 'green' ? 'bg-[#0f7b52] hover:bg-[#0b6644]' : 'bg-[#5b21b6] hover:bg-[#4a189b]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-50 ${toneClass}`}
    >
      {icon}
      {label}
    </button>
  )
}

export function PoDetailModal({
  po,
  onClose,
  canApprove,
  canCancel,
  canSend,
  canReceive,
  canClose,
  canEdit,
  canViewApBill,
  onApprove,
  onCancel,
  onSend,
  onReceive,
  onCloseOrder,
  onEdit,
  onViewInvoice,
  onViewReceipts,
  onDownload,
  isDownloading,
}: Props) {
  // Serial numbers only need fetching once a PO is closed — that's the point
  // at which receiving is done and there's a final list to show, per line,
  // instead of a partial/in-progress one.
  const [serialsByLine, setSerialsByLine] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (!po || po.status !== 'closed') {
      setSerialsByLine({})
      return
    }
    let cancelled = false
    getPurchaseOrderReceipts(po.id).then((res) => {
      if (cancelled || !res.success) return
      const byLine: Record<string, string[]> = {}
      for (const receipt of res.data?.data ?? []) {
        for (const line of receipt.lines) {
          if (!line.purchaseOrderLineId || !line.serialNumbers?.length) continue
          byLine[line.purchaseOrderLineId] = [
            ...(byLine[line.purchaseOrderLineId] ?? []),
            ...line.serialNumbers,
          ]
        }
      }
      setSerialsByLine(byLine)
    })
    return () => {
      cancelled = true
    }
  }, [po?.id, po?.status])

  if (!po) return null

  const subtotal = po.subtotalAmount ?? po.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const late = daysLate(po)
  const { received, ordered, pct } = receiptTotals(po.lines)
  const isCancelled = po.status === 'cancelled'
  const stageIndex = STAGE_INDEX[po.status] ?? 0

  // Approved orders must be sent before Receive is offered — the backend
  // still accepts a receipt posted directly against an approved PO (a
  // defensive allowance for edge cases, not the intended path), but the UI
  // only exposes it once the order has actually gone out the door.
  const receivable: PoStatus[] = ['sent', 'partially_received']
  const editable: PoStatus[] = ['draft', 'approved']
  const receipted: PoStatus[] = ['partially_received', 'fully_received', 'closed']

  const icon = 'h-3.5 w-3.5'

  return (
    // Full-bleed panel over the content area, matching CreatePoModal's and
    // ReceiveAgainstPoModal's shell — header, scrolling body, pinned footer —
    // rather than a centred dialog or a backdrop-and-drawer.
    <div className={`${PLEX} absolute inset-0 z-50 flex flex-col bg-[#f2f2f3] text-[#17171c]`}>
      {/* Header */}
      <div className="sticky top-0 z-40 flex flex-wrap items-start justify-between gap-4 border-b border-[#e4e4e9] bg-white px-5 py-3">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <div className={`${MONO} text-[10.5px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
            Purchase Order
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className={`${MONO} text-[17px] font-semibold tracking-[-.01em]`}>{po.code}</h2>
            <StatusBadge status={po.status} />
            {late > 0 && (
              <span className="text-[11.5px] font-medium text-[#b25e09]">
                {late === 1 ? '1 day late' : `${late} days late`}
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-[#8b8b9b]">
            Created {fmtDate(po.createdAt)}
            {po.fromPr && ` · from ${po.fromPr.code}`}
            {po.preparedByName && ` · ${po.preparedByName}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => onDownload?.(po)}
            disabled={isDownloading}
            title="Download PDF"
            aria-label="Download PDF"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e4e4e9] bg-white text-[#5b5b6b] transition-colors hover:border-[#d3d3db] hover:bg-[#f6f6f8] disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5b5b6b] hover:bg-[#f1f1f4] hover:text-[#17171c]"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
        {/* Lifecycle trail, or a cancellation banner in its place */}
        {isCancelled ? (
          <div className="rounded-xl border border-[#f3c9c5] bg-[#fdeceb] px-4 py-3">
            <p className="text-[13px] font-semibold text-[#b42318]">This order was cancelled</p>
            {po.cancellationReason && (
              <p className="mt-1 text-[12.5px] text-[#8a2a21]">{po.cancellationReason}</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#e4e4e9] bg-white px-4 py-3.5">
            {/* Each stage is a dot beside its own stacked label+date block,
                joined to the next stage by a connector — so the date always
                sits directly under its own label (for every stage, not just
                the ones already reached) without needing to sync a separate
                row of dates to a separate row of labels. */}
            <div className="flex min-w-max items-center gap-4">
              {STAGES.map((stage, i) => {
                const done = i < stageIndex
                const active = i === stageIndex
                const complete =
                  active && (po.status === 'fully_received' || po.status === 'closed')
                const dotColor =
                  done || complete ? 'bg-[#0f7b52]' : active ? 'bg-[#5b21b6]' : 'bg-[#d3d3db]'
                const ring = active && !complete ? 'shadow-[0_0_0_3px_#f0e9fc]' : ''
                const labelColor =
                  done || complete ? 'text-[#0b6644]' : active ? 'text-[#3f1490]' : 'text-[#8b8b9b]'
                return (
                  <div key={stage.key} className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-[9px] w-[9px] shrink-0 rounded-full ${dotColor} ${ring}`}
                      />
                      <div className="flex flex-col gap-px">
                        <span
                          className={`text-[12.5px] font-medium ${active ? 'font-semibold' : ''} ${labelColor}`}
                        >
                          {stage.label}
                        </span>
                        <span className="text-[11px] text-[#8b8b9b]">
                          {stageMeta(i, po, stageIndex, received, ordered)}
                        </span>
                      </div>
                    </div>
                    {i < STAGES.length - 1 && (
                      <span
                        className={`inline-block h-px w-[34px] shrink-0 ${done ? 'bg-[#b6e0cd]' : 'bg-[#e4e4e9]'}`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Supplier + facts */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_1.15fr]">
          <div className="rounded-xl border border-[#e4e4e9] bg-white p-4">
            <p className={`${MONO} text-[10px] uppercase tracking-[.09em] text-[#a3a3b2]`}>
              Supplier
            </p>
            <div className="mt-2.5 flex items-start gap-3">
              <SupplierAvatar name={po.supplier.name} className="h-9 w-9 shrink-0 text-[14px]" />
              <div className="min-w-0">
                <p className="text-[15px] font-semibold tracking-[-.005em]">{po.supplier.name}</p>
                {po.supplier.address && (
                  <p className="mt-0.5 text-[12px] leading-[1.45] text-[#5b5b6b]">
                    {po.supplier.address}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {po.supplier.taxId && (
                    <span className={`${MONO} text-[10.5px] text-[#5b5b6b]`}>
                      TIN {po.supplier.taxId}
                    </span>
                  )}
                  {po.paymentTerms && (
                    <span
                      className={`${MONO} rounded px-[7px] py-[2px] text-[10.5px] bg-[#f1f1f4] text-[#3d3d4a]`}
                    >
                      {po.paymentTerms}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#e4e4e9] bg-white p-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 min-[560px]:grid-cols-3">
              <InfoRow label="Requested By" value={po.branch?.name ?? 'Tenant-wide'} />
              <InfoRow label="Destination" value={locationLabel(po.warehouse)} />
              <InfoRow label="Order Date" value={fmtDate(po.orderDate)} />
              <InfoRow
                label="Expected Delivery"
                value={fmtDate(po.expectedDeliveryDate)}
                muted={!po.expectedDeliveryDate}
              />
              <InfoRow
                label="Approved"
                value={
                  po.approvedByName ? `${po.approvedByName} · ${fmtDate(po.approvedAt)}` : 'Pending'
                }
                muted={!po.approvedByName}
              />
            </div>
            {(po.warehouse?.address ||
              po.shippingAddress ||
              po.deliveryInstructions ||
              po.notes) && (
              <div className="mt-3 space-y-2.5 border-t border-[#f1f1f4] pt-3">
                {po.warehouse?.address && (
                  <InfoRow label="Destination Address" value={po.warehouse.address} />
                )}
                {po.shippingAddress && (
                  <InfoRow label="Shipping Address" value={po.shippingAddress} />
                )}
                {po.deliveryInstructions && (
                  <InfoRow label="Delivery Instructions" value={po.deliveryInstructions} />
                )}
                {po.notes && <InfoRow label="Notes" value={po.notes} />}
              </div>
            )}
          </div>
        </div>

        {/* Line items */}
        <div className="overflow-hidden rounded-xl border border-[#e4e4e9] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#eeeef1] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-semibold">Line Items</span>
              <span className={`${MONO} text-[11px] text-[#8b8b9b]`}>
                {po.lines.length} {po.lines.length === 1 ? 'line' : 'lines'} · {ordered} units
              </span>
            </div>
            {!isCancelled && (
              <span
                className={`rounded-[5px] px-[9px] py-[3px] text-[11.5px] font-medium ${
                  pct === 100
                    ? 'bg-[#e7f5ef] text-[#0b6644]'
                    : pct > 0
                      ? 'bg-[#fdf3e7] text-[#8a4b06]'
                      : 'bg-[#f1f1f4] text-[#5b5b6b]'
                }`}
              >
                {received} of {ordered} received · {pct}%
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr
                  className={`${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] text-[10px] uppercase tracking-[.09em] text-[#8b8b9b]`}
                >
                  <th className="px-4 py-2.5 text-left">Item / SKU</th>
                  <th className="px-3 py-2.5 text-right">Ordered</th>
                  <th className="px-3 py-2.5 text-right">Received</th>
                  <th className="w-[150px] px-3 py-2.5 text-left">Progress</th>
                  <th className="px-3 py-2.5 text-right">Unit Price</th>
                  <th className="px-4 py-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f4f6]">
                {po.lines.map((line) => {
                  const lineOrdered = Number(line.quantity)
                  const lineReceived = Number(line.receivedQuantity ?? 0)
                  const linePct =
                    lineOrdered > 0
                      ? Math.min(Math.round((lineReceived / lineOrdered) * 100), 100)
                      : 0
                  const lineFull = lineOrdered > 0 && lineReceived >= lineOrdered
                  return (
                    <tr key={line.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13px] font-medium text-[#17171c]">{line.item.name}</p>
                          {line.isFreebie && (
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-[#e7f5ef] text-[#0b6644]">
                              Freebie
                            </span>
                          )}
                        </div>
                        <p className={`${MONO} text-[10.5px] text-[#8b8b9b]`}>{line.item.sku}</p>
                        {line.description && (
                          <p className="mt-0.5 text-[11.5px] text-[#5b5b6b]">{line.description}</p>
                        )}
                        {/* This wording is the one the Receiving Report, the AP
                              bill and the printed Purchase Invoice all follow —
                              so it now comes from the shared formatter rather
                              than being restated here, where a tweak on one
                              screen would silently make the four disagree. */}
                        {discountChainLabel(line, fmtPeso) && (
                          <p className="mt-0.5 text-[11.5px] text-[#5b5b6b]">
                            {discountChainLabel(line, fmtPeso)}
                          </p>
                        )}
                        {(serialsByLine[line.id] ?? []).length > 0 && (
                          <div className="mt-1.5">
                            <p
                              className={`${MONO} text-[10px] uppercase tracking-[.08em] text-[#a3a3b2]`}
                            >
                              Serial Numbers ({serialsByLine[line.id].length})
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {serialsByLine[line.id].map((sn) => (
                                <span
                                  key={sn}
                                  className={`${MONO} rounded bg-[#f1f1f4] px-1.5 py-0.5 text-[10px] text-[#3d3d4a]`}
                                >
                                  {sn}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className={`${MONO} px-3 py-3 text-right text-[13px] text-[#3d3d4a]`}>
                        {lineOrdered}
                      </td>
                      <td
                        className={`${MONO} px-3 py-3 text-right text-[13px] ${
                          lineFull
                            ? 'font-semibold text-[#0b6644]'
                            : lineReceived > 0
                              ? 'font-semibold text-[#8a4b06]'
                              : 'text-[#a3a3b2]'
                        }`}
                      >
                        {lineReceived}
                      </td>
                      <td className="px-3 py-3">
                        <div className="h-[5px] w-full overflow-hidden rounded-[3px] bg-[#eeeef1]">
                          <div
                            className={`h-full rounded-[3px] ${
                              lineFull
                                ? 'bg-[#0f7b52]'
                                : lineReceived > 0
                                  ? 'bg-[#d18b1d]'
                                  : 'bg-[#e4e4e9]'
                            }`}
                            style={{ width: `${linePct}%` }}
                          />
                        </div>
                      </td>
                      <td className={`${MONO} px-3 py-3 text-right text-[13px] text-[#3d3d4a]`}>
                        {fmtPeso(line.unitPrice)}
                      </td>
                      <td
                        className={`${MONO} px-4 py-3 text-right text-[13.5px] font-semibold text-[#17171c]`}
                      >
                        {fmtPeso(line.lineTotal ?? line.quantity * line.unitPrice)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end border-t border-[#e4e4e9] bg-[#fbfbfc] px-4 py-3.5">
            <div className="w-full max-w-[260px] space-y-1.5">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-[#5b5b6b]">Subtotal</span>
                <span className={`${MONO} text-[#3d3d4a]`}>{fmtPeso(subtotal)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t border-[#e4e4e9] pt-1.5">
                <span className="text-[13px] font-semibold">Total</span>
                <span className={`${MONO} text-[17px] font-semibold`}>
                  {fmtPeso(Number(po.totalAmount))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 z-40 flex flex-wrap items-center justify-end gap-2 border-t border-[#e4e4e9] bg-white px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#5b5b6b] hover:bg-[#f1f1f4] hover:text-[#17171c]"
        >
          Close
        </button>

        {canEdit && editable.includes(po.status) && (
          <OutlineBtn
            icon={<Pencil className={icon} />}
            label="Edit"
            onClick={() => onEdit?.(po)}
          />
        )}

        {receipted.includes(po.status) && (
          <OutlineBtn
            icon={<FileText className={icon} />}
            label="View Receipts"
            onClick={() => onViewReceipts?.(po)}
          />
        )}

        {canViewApBill && po.apBills.length > 0 && (
          <OutlineBtn
            icon={<Receipt className={icon} />}
            label="View Invoice"
            onClick={() => onViewInvoice?.(po)}
          />
        )}

        {canCancel && (po.status === 'draft' || po.status === 'approved') && (
          <OutlineBtn
            icon={<Ban className={icon} />}
            label="Cancel PO"
            tone="red"
            onClick={() => onCancel?.(po)}
          />
        )}

        {canApprove && po.status === 'draft' && (
          <PrimaryBtn
            icon={<CheckCircle className={icon} />}
            label="Approve"
            onClick={() => onApprove?.(po)}
          />
        )}

        {canSend && po.status === 'approved' && (
          <PrimaryBtn
            icon={<Send className={icon} />}
            label="Send to Supplier"
            onClick={() => onSend?.(po)}
          />
        )}

        {canReceive && receivable.includes(po.status) && (
          <PrimaryBtn
            icon={<PackagePlus className={icon} />}
            label={po.status === 'partially_received' ? 'Receive' : 'Receive Stock'}
            onClick={() => onReceive?.(po)}
          />
        )}

        {/* Closing before the order is fully received abandons whatever
            quantity is still outstanding — this panel only offers it once
            there's nothing left to receive. */}
        {canClose && po.status === 'fully_received' && (
          <PrimaryBtn
            icon={<Archive className={icon} />}
            label="Close Order"
            tone="green"
            onClick={() => onCloseOrder?.(po)}
          />
        )}
      </div>
    </div>
  )
}
