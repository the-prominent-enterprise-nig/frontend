'use client'

import { useEffect, useRef, useState } from 'react'
import {
  X,
  PackageCheck,
  AlertTriangle,
  Warehouse,
  CalendarDays,
  Printer,
  Download,
  Loader2,
  Pencil,
} from 'lucide-react'
import { getPurchaseOrderReceipts, type PoReceipt } from '../_actions/get-purchase-order-receipts'
import { getReceivingDocument } from '../../goods-receiving/_actions/get-receiving-document'
import { getReceivingReport } from '../../goods-receiving/_actions/get-receiving-report'
import ReceivingReportSheet, {
  type ReceivingReportDocument,
} from '../../../accounting/receiving-reports/_components/ReceivingReportSheet'
import ReceivingReportEditForm from '../../../accounting/receiving-reports/_components/ReceivingReportEditForm'
import { printReceivingReportDocument } from '@/src/libs/print/printInventoryDocument'
import { downloadElementAsPdf } from '@/src/libs/print/htmlToPdf'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import type { ReceivingReport } from '@/src/schema/inventory/goods-receiving'
import { locationLabel } from '@/src/libs/format/locationLabel'
import { PLEX, MONO, receiptTotals } from './procurementTokens'

type Props = {
  po: PurchaseOrderSummary | null
  onClose: () => void
}

// ─── Shared helpers ────────────────────────────────────────────────────────────
// Same #5b21b6 palette as procurementTokens/PoDetailModal — this
// drawer is opened from that panel's "View Receipts" button, so it has to
// read as the same screen rather than a visually separate one.

function lineTotals(lines: PoReceipt['lines']): { received: number; ordered: number } {
  return lines.reduce(
    (acc, l) => ({
      received: acc.received + l.quantityReceived,
      ordered: acc.ordered + l.qtyOrdered,
    }),
    { received: 0, ordered: 0 }
  )
}

function ReceiptStatusChip({ received, ordered }: { received: number; ordered: number }) {
  if (received < ordered)
    return (
      <span className="rounded-[5px] bg-[#fdf3e7] px-[9px] py-[3px] text-[11px] font-medium text-[#8a4b06]">
        Short
      </span>
    )
  if (received > ordered)
    return (
      <span className="rounded-[5px] bg-[#eaf0fb] px-[9px] py-[3px] text-[11px] font-medium text-[#1f4b99]">
        Over
      </span>
    )
  return (
    <span className="rounded-[5px] bg-[#e7f5ef] px-[9px] py-[3px] text-[11px] font-medium text-[#0b6644]">
      Complete
    </span>
  )
}

function QcHoldChip() {
  return (
    <span className="flex items-center gap-1 rounded-[5px] bg-[#fdf3e7] px-[9px] py-[3px] text-[11px] font-medium text-[#8a4b06]">
      <AlertTriangle className="h-3 w-3" />
      QC Hold
    </span>
  )
}

/** Sits directly under the Deliveries / Units received / Ordered tiles,
 * stretched to their width, rather than inline with any one line of text. */
function OverallProgress({ received, ordered }: { received: number; ordered: number }) {
  const pct = ordered > 0 ? Math.min(Math.round((received / ordered) * 100), 100) : 0
  const bar = pct >= 100 ? 'bg-[#0f7b52]' : pct > 0 ? 'bg-[#d18b1d]' : 'bg-[#e4e4e9]'
  const tone = pct >= 100 ? 'text-[#0b6644]' : pct > 0 ? 'text-[#8a4b06]' : 'text-[#5b5b6b]'

  return (
    <div className="flex items-center gap-2">
      <div className="h-[6px] flex-1 overflow-hidden rounded-[3px] bg-[#eeeef1]">
        <div
          className={`h-full rounded-[3px] transition-all duration-500 ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`${MONO} shrink-0 text-[11.5px] font-semibold ${tone}`}>
        {received}/{ordered} · {pct}%
      </span>
    </div>
  )
}

// ─── List pane ────────────────────────────────────────────────────────────────

function SkeletonListItem() {
  return (
    <div className="animate-pulse space-y-2 rounded-xl border border-[#e4e4e9] bg-white p-3">
      <div className="h-3.5 w-32 rounded bg-[#eeeef1]" />
      <div className="h-3 w-40 rounded bg-[#eeeef1]" />
      <div className="flex gap-1.5 pt-1">
        <div className="h-4 w-14 rounded bg-[#eeeef1]" />
        <div className="h-4 w-14 rounded bg-[#eeeef1]" />
      </div>
    </div>
  )
}

/** Full serial list belongs to the printed sheet, not the card — this is
 * only enough to say "yes, these are serialized" at a glance. */
function SerialPreview({ serials }: { serials: string[] }) {
  if (serials.length === 0) return null
  const shown = serials.slice(0, 4)
  const hidden = serials.length - shown.length

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {shown.map((sn) => (
        <span
          key={sn}
          className={`${MONO} rounded bg-[#f1f1f4] px-1.5 py-0.5 text-[10px] text-[#3d3d4a]`}
        >
          {sn}
        </span>
      ))}
      {hidden > 0 && (
        <span className={`${MONO} rounded bg-[#f1f1f4] px-1.5 py-0.5 text-[10px] text-[#a3a3b2]`}>
          +{hidden}
        </span>
      )}
    </div>
  )
}

function ReceiptListItem({
  grn,
  index,
  active,
  onSelect,
}: {
  grn: PoReceipt
  index: number
  active: boolean
  onSelect: () => void
}) {
  const { received, ordered } = lineTotals(grn.lines)
  const hasHold = grn.lines.some((l) => l.qualityHold)
  const serials = grn.lines.flatMap((l) => l.serialNumbers ?? [])

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`w-full rounded-xl border bg-white p-2.5 text-left transition-colors ${
        active
          ? 'border-[#7c4fd1] shadow-[0_0_0_3px_#f4efff]'
          : 'border-[#e4e4e9] hover:border-[#d3d3db]'
      }`}
    >
      {/* One header row (badge, code, status) and one flex-wrap meta row
          (date · warehouse · DR · line/unit count) instead of four stacked
          blocks — the same facts, in about half the card height. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
              active ? 'bg-[#5b21b6] text-white' : 'bg-[#f1ebfb] text-[#3f1490]'
            }`}
          >
            {index + 1}
          </span>
          <p className={`${MONO} text-[13px] font-semibold text-[#17171c]`}>{grn.code}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {hasHold && <QcHoldChip />}
          <ReceiptStatusChip received={received} ordered={ordered} />
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[#8b8b9b]">
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {new Date(grn.receivedAt).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
        {grn.warehouse && (
          <span className="flex items-center gap-1">
            <Warehouse className="h-3 w-3" />
            {locationLabel(grn.warehouse)}
          </span>
        )}
        {grn.deliveryReceiptNumber && <span className={MONO}>DR {grn.deliveryReceiptNumber}</span>}
        <span className={MONO}>
          {grn.lines.length} line{grn.lines.length !== 1 ? 's' : ''} · {received} units
        </span>
      </div>

      <SerialPreview serials={serials} />
    </button>
  )
}

// ─── Document pane ────────────────────────────────────────────────────────────
// Renders the same faithful receiving-report preview the Goods Receiving
// detail screen prints (ReceivingReportSheet + printReceivingReportDocument)
// — so what a reader sees here is the actual paper, not a second rendering
// of it that could quietly drift from what prints.

function DocumentSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-8">
      <div className="h-6 w-48 rounded bg-[#eeeef1]" />
      <div className="grid grid-cols-3 gap-6">
        <div className="h-16 rounded bg-[#f1f1f4]" />
        <div className="h-16 rounded bg-[#f1f1f4]" />
        <div className="h-16 rounded bg-[#f1f1f4]" />
      </div>
      <div className="h-40 rounded bg-[#f1f1f4]" />
    </div>
  )
}

function DocumentToolbar({
  grn,
  receivedByName,
  doc,
  editing,
  onEdit,
  onDownload,
  downloadingPdf,
}: {
  grn: PoReceipt
  receivedByName?: string | null
  doc: ReceivingReportDocument | null
  editing: boolean
  onEdit: () => void
  onDownload: () => void
  downloadingPdf: boolean
}) {
  const { received, ordered } = lineTotals(grn.lines)

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e4e4e9] bg-white px-5 py-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`${MONO} text-[13px] font-semibold text-[#17171c]`}>{grn.code}</span>
        <ReceiptStatusChip received={received} ordered={ordered} />
        {receivedByName && (
          <span className="text-[12px] text-[#5b5b6b]">Received by {receivedByName}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!editing && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg border border-[#d3d3db] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#17171c] transition-colors hover:border-[#a3a3b2] hover:bg-[#f6f6f8]"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
        <button
          type="button"
          disabled={!doc || downloadingPdf}
          onClick={onDownload}
          className="flex items-center gap-1.5 rounded-lg border border-[#d3d3db] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#17171c] transition-colors hover:border-[#a3a3b2] hover:bg-[#f6f6f8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloadingPdf ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Download
        </button>
        <button
          type="button"
          disabled={!doc}
          onClick={() => doc && printReceivingReportDocument(doc)}
          className="flex items-center gap-1.5 rounded-lg bg-[#5b21b6] px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#4a189b] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>
      </div>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function PoReceiptsPanel({ po, onClose }: Props) {
  const [receipts, setReceipts] = useState<PoReceipt[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState<ReceivingReportDocument | null>(null)
  const [record, setRecord] = useState<ReceivingReport | null>(null)
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!po) return
    setIsLoading(true)
    setError(null)
    getPurchaseOrderReceipts(po.id)
      .then((res) => {
        if (res.success) {
          const data = res.data?.data ?? []
          setReceipts(data)
          setSelectedId(data[0]?.id ?? null)
        } else {
          setError(res.message ?? 'Failed to load receipts')
        }
      })
      .finally(() => setIsLoading(false))
  }, [po])

  // The lightweight receipt list already carries per-line quantities, so
  // selecting a card is instant — these two fetches only back the full
  // printable sheet (letterhead, unit costs, brand/model/type) and the
  // editable record (SRP/discounts/tax/batch) the Edit form needs, neither of
  // which the list carries or the receipts endpoint returns.
  useEffect(() => {
    setEditing(false)
    if (!selectedId) {
      setDoc(null)
      setRecord(null)
      return
    }
    setDocLoading(true)
    setDocError(null)
    Promise.all([getReceivingDocument(selectedId), getReceivingReport(selectedId)]).then(
      ([docRes, recRes]) => {
        if (docRes.success) setDoc(docRes.data as ReceivingReportDocument)
        else setDocError(docRes.message ?? docRes.error ?? 'Failed to load document')
        if (recRes.success && recRes.data) setRecord(recRes.data)
        setDocLoading(false)
      }
    )
  }, [selectedId])

  if (!po) return null

  const { received: totalReceived, ordered: totalOrdered } = receiptTotals(po.lines)
  const selectedGrn = receipts.find((r) => r.id === selectedId) ?? null

  const handleDownloadPdf = async () => {
    if (!sheetRef.current || !selectedGrn) return
    setDownloadingPdf(true)
    try {
      await downloadElementAsPdf(sheetRef.current, selectedGrn.code)
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Re-fetch after a correction: the sheet renders the document, which the
  // edit changed too, and the record backs the form should it reopen.
  const refetchAfterSave = () => {
    setEditing(false)
    if (!selectedId) return
    Promise.all([getReceivingDocument(selectedId), getReceivingReport(selectedId)]).then(
      ([docRes, recRes]) => {
        if (docRes.success) setDoc(docRes.data as ReceivingReportDocument)
        if (recRes.success && recRes.data) setRecord(recRes.data)
      }
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over */}
      <div
        className={`${PLEX} fixed inset-y-0 right-0 z-50 flex w-full max-w-6xl flex-col bg-white text-[#17171c] shadow-2xl`}
      >
        {/* Header — the progress bar sits under the Deliveries / Units
            received / Ordered tiles, stretched to their width, rather than
            on its own full-width row. */}
        <div className="border-b border-[#e4e4e9] px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-[3px]">
              <span className={`${MONO} text-[10.5px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
                Delivery Receipts
              </span>
              <h2 className={`${MONO} text-[17px] font-semibold tracking-[-.01em]`}>{po.code}</h2>
              <p className="text-[13px] text-[#5b5b6b]">
                {po.supplier.name} · {locationLabel(po.warehouse)}
              </p>
            </div>

            <div className="flex items-start gap-5">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-5 text-[13px]">
                  <div>
                    <p className={`${MONO} text-[10px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
                      Deliveries
                    </p>
                    <p className="text-[15px] font-semibold text-[#17171c]">{receipts.length}</p>
                  </div>
                  <div className="h-6 w-px bg-[#e4e4e9]" />
                  <div>
                    <p className={`${MONO} text-[10px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
                      Units received
                    </p>
                    <p className="text-[15px] font-semibold text-[#17171c]">{totalReceived}</p>
                  </div>
                  <div className="h-6 w-px bg-[#e4e4e9]" />
                  <div>
                    <p className={`${MONO} text-[10px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
                      Ordered
                    </p>
                    <p className="text-[15px] font-semibold text-[#17171c]">{totalOrdered}</p>
                  </div>
                </div>

                <OverallProgress received={totalReceived} ordered={totalOrdered} />
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#5b5b6b] hover:bg-[#f1f1f4] hover:text-[#17171c]"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex-1 space-y-3 overflow-y-auto bg-[#f7f7f8] p-6">
            <SkeletonListItem />
            <SkeletonListItem />
          </div>
        ) : error ? (
          <div className="bg-[#f7f7f8] p-6">
            <div className="rounded-xl border border-[#f3c9c5] bg-[#fdeceb] p-4">
              <p className="text-[13px] font-medium text-[#b42318]">{error}</p>
            </div>
          </div>
        ) : receipts.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center bg-[#f7f7f8] px-6 py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#eeeef1]">
              <PackageCheck className="h-8 w-8 text-[#a3a3b2]" />
            </div>
            <p className="text-[13px] font-semibold text-[#17171c]">No deliveries yet</p>
            <p className="mt-1 max-w-xs text-[12px] text-[#8b8b9b]">
              Receiving reports appear here as stock arrives against this purchase order.
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* List pane */}
            <div className="min-h-0 shrink-0 space-y-2.5 overflow-y-auto border-b border-[#eeeef1] bg-[#f7f7f8] px-4 py-4 lg:w-75 lg:border-b-0 lg:border-r lg:border-[#e4e4e9]">
              {receipts.map((grn, i) => (
                <ReceiptListItem
                  key={grn.id}
                  grn={grn}
                  index={i}
                  active={grn.id === selectedId}
                  onSelect={() => setSelectedId(grn.id)}
                />
              ))}
            </div>

            {/* Document pane */}
            <div className="flex min-h-0 flex-1 flex-col bg-[#ececed]">
              {selectedGrn && (
                <DocumentToolbar
                  grn={selectedGrn}
                  receivedByName={doc?.document.receivedByName}
                  doc={doc}
                  editing={editing}
                  onEdit={() => setEditing(true)}
                  onDownload={() => void handleDownloadPdf()}
                  downloadingPdf={downloadingPdf}
                />
              )}

              <div className="min-h-0 flex-1 overflow-y-auto p-6">
                {docLoading ? (
                  <div className="mx-auto max-w-3xl rounded-lg border border-[#e4e4e9] bg-white shadow-sm">
                    <DocumentSkeleton />
                  </div>
                ) : docError ? (
                  <div className="mx-auto max-w-3xl rounded-xl border border-[#f3c9c5] bg-[#fdeceb] p-4">
                    <p className="text-[13px] font-medium text-[#b42318]">{docError}</p>
                  </div>
                ) : (
                  <div className="mx-auto max-w-3xl space-y-4">
                    {editing && record && selectedId && (
                      <ReceivingReportEditForm
                        id={selectedId}
                        record={record}
                        onCancel={() => setEditing(false)}
                        onSaved={refetchAfterSave}
                      />
                    )}
                    {doc && (
                      <div className="rounded-lg border border-[#e4e4e9] bg-white shadow-sm">
                        <div ref={sheetRef}>
                          <ReceivingReportSheet doc={doc} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
