'use client'

import { Ban, CheckCircle2, Pencil, Send, X } from 'lucide-react'
import type { PurchaseRequestSummary } from '@/src/schema/inventory/purchase-requests'
import { locationLabel } from '@/src/libs/format/locationLabel'
import { discountChainLabel } from '@/src/libs/format/discount-chain'
import { PLEX, MONO } from '../../purchase-orders/_components/procurementTokens'
import { StatusBadge, OutlineBtn, PrimaryBtn } from './PurchaseRequestList'

type Props = {
  open: boolean
  onClose: () => void
  pr: PurchaseRequestSummary | null
  // Every button here just hands the request back to the caller, same
  // contract PoDetailModal uses — the caller owns whatever confirm dialog
  // or follow-on modal it opens (ConfirmActionModal, ConvertPrToPoModal,
  // CreatePoModal in edit mode) and decides whether the current user may
  // take each action; when the matching `can*` flag is omitted the button
  // doesn't render at all.
  canEdit?: boolean
  canSubmit?: boolean
  canCancel?: boolean
  canConvert?: boolean
  onEdit?: (pr: PurchaseRequestSummary) => void
  onSubmit?: (pr: PurchaseRequestSummary) => void
  onCancel?: (pr: PurchaseRequestSummary) => void
  onConvert?: (pr: PurchaseRequestSummary) => void
  /** Opens the PO this request became — only relevant once converted. */
  onViewPo?: (poId: string) => void
}

const fmtPHP = (n: number): string =>
  n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function InfoRow({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}): React.ReactElement {
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

// A PR line has no stored discountedCost (unlike a PO line, computed
// server-side) — apply the same sequential chain client-side, same formula
// PurchaseOrderFormFields.tsx uses for its own live preview, so the shared
// discountChainLabel formatter (PO detail / Receiving Report / AP bill) can
// still render the final discounted cost here too.
function discountedCostFor(
  srp: number,
  discounts: PurchaseRequestSummary['lines'][number]['discounts']
): number {
  return (discounts ?? []).reduce(
    (price, d) => (d.type === 'percentage' ? price * (1 - d.value / 100) : price - d.value),
    srp
  )
}

export function ViewPurchaseRequestModal({
  open,
  onClose,
  pr,
  canEdit,
  canSubmit,
  canCancel,
  canConvert,
  onEdit,
  onSubmit,
  onCancel,
  onConvert,
  onViewPo,
}: Props) {
  if (!open || !pr) return null

  const total = pr.lines.reduce(
    (sum, line) => (line.isFreebie ? sum : sum + line.quantity * (line.unitPrice ?? 0)),
    0
  )

  const icon = 'h-3.5 w-3.5'

  return (
    // Full-bleed panel over the content area — same shell PoDetailModal uses
    // (header, scrolling body, pinned footer) rather than a centred dialog,
    // since this opens from the same list a PO's own detail panel does.
    <div className={`${PLEX} absolute inset-0 z-50 flex flex-col bg-[#f2f2f3] text-[#17171c]`}>
      {/* Header */}
      <div className="sticky top-0 z-40 flex flex-wrap items-start justify-between gap-4 border-b border-[#e4e4e9] bg-white px-5 py-3">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <div className={`${MONO} text-[10.5px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
            Purchase Request
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className={`${MONO} text-[17px] font-semibold tracking-[-.01em]`}>{pr.code}</h2>
            <StatusBadge status={pr.status} />
          </div>
          <p className="text-[11.5px] text-[#8b8b9b]">
            Created {fmtDate(pr.createdAt)}
            {pr.submittedAt && ` · Submitted ${fmtDate(pr.submittedAt)}`}
          </p>
        </div>
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

      <div className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
        {pr.status === 'cancelled' && (
          <div className="rounded-xl border border-[#f3c9c5] bg-[#fdeceb] px-4 py-3">
            <p className="text-[13px] font-semibold text-[#b42318]">This request was cancelled</p>
          </div>
        )}

        {pr.status === 'converted' && pr.convertedToPo && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ddd0f7] bg-[#f1ebfb] px-4 py-3">
            <p className="text-[13px] text-[#3f1490]">
              Converted to <span className={`${MONO} font-semibold`}>{pr.convertedToPo.code}</span>
            </p>
            {onViewPo && (
              <OutlineBtn
                label="View purchase order"
                onClick={() => onViewPo(pr.convertedToPo!.id)}
              />
            )}
          </div>
        )}

        {/* Supplier + facts */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_1.15fr]">
          <div className="rounded-xl border border-[#e4e4e9] bg-white p-4">
            <p className={`${MONO} text-[10px] uppercase tracking-[.09em] text-[#a3a3b2]`}>
              Supplier
            </p>
            <div className="mt-2.5">
              <p className="text-[15px] font-semibold tracking-[-.005em]">
                {pr.supplier?.name ?? <span className="text-[#a3a3b2]">Not yet specified</span>}
              </p>
              {pr.supplier?.address && (
                <p className="mt-0.5 text-[12px] leading-[1.45] text-[#5b5b6b]">
                  {pr.supplier.address}
                </p>
              )}
              {pr.supplier?.taxId && (
                <span className={`${MONO} mt-1.5 inline-block text-[10.5px] text-[#5b5b6b]`}>
                  TIN {pr.supplier.taxId}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#e4e4e9] bg-white p-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 min-[560px]:grid-cols-3">
              <InfoRow label="Requested By" value={pr.branch?.name ?? 'Tenant-wide'} />
              <InfoRow
                label="Destination"
                value={locationLabel(pr.warehouse)}
                muted={!pr.warehouse}
              />
              <InfoRow
                label="Expected Delivery"
                value={fmtDate(pr.expectedDeliveryDate)}
                muted={!pr.expectedDeliveryDate}
              />
            </div>
            {(pr.reason || pr.notes) && (
              <div className="mt-3 space-y-2.5 border-t border-[#f1f1f4] pt-3">
                {pr.reason && <InfoRow label="Reason" value={pr.reason} />}
                {pr.notes && <InfoRow label="Notes" value={pr.notes} />}
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
                {pr.lines.length} {pr.lines.length === 1 ? 'line' : 'lines'}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr
                  className={`${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] text-[10px] uppercase tracking-[.09em] text-[#8b8b9b]`}
                >
                  <th className="px-4 py-2.5 text-left">Item / SKU</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Unit Price</th>
                  <th className="px-4 py-2.5 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f4f6]">
                {pr.lines.map((line) => {
                  const chain =
                    line.srp != null
                      ? discountChainLabel(
                          {
                            srp: line.srp,
                            discounts: line.discounts,
                            discountedCost: discountedCostFor(Number(line.srp), line.discounts),
                          },
                          fmtPHP
                        )
                      : ''
                  return (
                    <tr key={line.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13px] font-medium text-[#17171c]">{line.item.name}</p>
                          {line.isFreebie && (
                            <span className="rounded bg-[#e7f5ef] px-1.5 py-0.5 text-[10px] font-semibold text-[#0b6644]">
                              Freebie
                            </span>
                          )}
                        </div>
                        <p className={`${MONO} text-[10.5px] text-[#8b8b9b]`}>{line.item.sku}</p>
                        {line.notes && (
                          <p className="mt-0.5 text-[11.5px] text-[#5b5b6b]">{line.notes}</p>
                        )}
                        {chain && <p className="mt-0.5 text-[11.5px] text-[#5b5b6b]">{chain}</p>}
                      </td>
                      <td className={`${MONO} px-3 py-3 text-right text-[13px] text-[#3d3d4a]`}>
                        {line.quantity}
                      </td>
                      <td className={`${MONO} px-3 py-3 text-right text-[13px] text-[#3d3d4a]`}>
                        {line.isFreebie
                          ? 'Freebie'
                          : line.unitPrice != null
                            ? fmtPHP(line.unitPrice)
                            : '—'}
                      </td>
                      <td
                        className={`${MONO} px-4 py-3 text-right text-[13.5px] font-semibold text-[#17171c]`}
                      >
                        {line.isFreebie
                          ? fmtPHP(0)
                          : line.unitPrice != null
                            ? fmtPHP(line.quantity * line.unitPrice)
                            : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="flex justify-end border-t border-[#e4e4e9] bg-[#fbfbfc] px-4 py-3.5">
              <div className="flex items-baseline gap-6">
                <span className="text-[13px] font-semibold">Total</span>
                <span className={`${MONO} text-[17px] font-semibold`}>{fmtPHP(total)}</span>
              </div>
            </div>
          )}
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

        {pr.status === 'draft' && canEdit && onEdit && (
          <OutlineBtn
            size="md"
            icon={<Pencil className={icon} />}
            label="Edit"
            onClick={() => onEdit(pr)}
          />
        )}

        {(pr.status === 'draft' || pr.status === 'submitted') && canCancel && onCancel && (
          <OutlineBtn
            size="md"
            tone="red"
            icon={<Ban className={icon} />}
            label="Cancel Request"
            onClick={() => onCancel(pr)}
          />
        )}

        {pr.status === 'draft' && canSubmit && onSubmit && (
          <PrimaryBtn
            size="md"
            icon={<Send className={icon} />}
            label="Submit"
            onClick={() => onSubmit(pr)}
          />
        )}

        {pr.status === 'submitted' && canConvert && onConvert && (
          <PrimaryBtn
            size="md"
            icon={<CheckCircle2 className={icon} />}
            label="Convert to PO"
            onClick={() => onConvert(pr)}
          />
        )}
      </div>
    </div>
  )
}
