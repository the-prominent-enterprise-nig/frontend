'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Printer, Download, Loader2 } from 'lucide-react'
import { getPurchaseOrderDocument } from '../_actions/get-purchase-order-document'
import { getPurchaseOrderReceipts } from '../_actions/get-purchase-order-receipts'
import PurchaseOrderSheet, { type PurchaseOrderPrintDocument } from './PurchaseOrderSheet'
import { printPurchaseOrderDocument } from '@/src/libs/print/printInventoryDocument'
import { downloadElementAsPdf } from '@/src/libs/print/htmlToPdf'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import { locationLabel } from '@/src/libs/format/locationLabel'
import { PLEX, MONO, StatusBadge } from './procurementTokens'

type Props = {
  po: PurchaseOrderSummary | null
  onClose: () => void
}

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

// ─── Panel ────────────────────────────────────────────────────────────────────
// Same slide-over shell as PoReceiptsPanel (opened from the same PoDetailModal
// footer row), minus that panel's left list pane — a PO has exactly one
// document to show, not a list of deliveries to pick between.

export function PoViewPanel({ po, onClose }: Props) {
  const [doc, setDoc] = useState<PurchaseOrderPrintDocument | null>(null)
  const [serialsByLineId, setSerialsByLineId] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!po) return
    setLoading(true)
    setError(null)
    setDoc(null)
    Promise.all([
      getPurchaseOrderDocument(po.id),
      // Serial numbers only exist to show once a PO is closed — receiving
      // is done at that point, so there's a final per-line list, not a
      // partial/in-progress one worth printing.
      po.status === 'closed' ? getPurchaseOrderReceipts(po.id) : Promise.resolve(null),
    ])
      .then(([docRes, receiptsRes]) => {
        if (docRes.success && docRes.data) {
          setDoc(docRes.data as PurchaseOrderPrintDocument)
        } else {
          setError(docRes.message ?? docRes.error ?? 'Failed to load document')
        }
        const byLine: Record<string, string[]> = {}
        for (const receipt of receiptsRes?.success ? (receiptsRes.data?.data ?? []) : []) {
          for (const line of receipt.lines) {
            if (!line.purchaseOrderLineId || !line.serialNumbers?.length) continue
            byLine[line.purchaseOrderLineId] = [
              ...(byLine[line.purchaseOrderLineId] ?? []),
              ...line.serialNumbers,
            ]
          }
        }
        setSerialsByLineId(byLine)
      })
      .finally(() => setLoading(false))
  }, [po])

  if (!po) return null

  const handleDownloadPdf = async () => {
    if (!sheetRef.current) return
    setDownloadingPdf(true)
    try {
      await downloadElementAsPdf(sheetRef.current, po.code)
    } finally {
      setDownloadingPdf(false)
    }
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
        className={`${PLEX} fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col bg-white text-[#17171c] shadow-2xl`}
      >
        {/* Header */}
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-[#e4e4e9] px-6 py-5">
          <div className="flex min-w-0 flex-col gap-[3px]">
            <span className={`${MONO} text-[10.5px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
              Purchase Order
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className={`${MONO} text-[17px] font-semibold tracking-[-.01em]`}>{po.code}</h2>
              <StatusBadge status={po.status} />
            </div>
            <p className="text-[13px] text-[#5b5b6b]">
              {po.supplier.name} · {locationLabel(po.warehouse)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!doc || downloadingPdf}
              onClick={() => void handleDownloadPdf()}
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
              onClick={() => doc && printPurchaseOrderDocument(doc, serialsByLineId)}
              className="flex items-center gap-1.5 rounded-lg bg-[#5b21b6] px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#4a189b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
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

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#ececed] p-6">
          {loading ? (
            <div className="mx-auto max-w-3xl rounded-lg border border-[#e4e4e9] bg-white shadow-sm">
              <DocumentSkeleton />
            </div>
          ) : error ? (
            <div className="mx-auto max-w-3xl rounded-xl border border-[#f3c9c5] bg-[#fdeceb] p-4">
              <p className="text-[13px] font-medium text-[#b42318]">{error}</p>
            </div>
          ) : doc ? (
            <div className="mx-auto max-w-3xl rounded-lg border border-[#e4e4e9] bg-white shadow-sm">
              <div ref={sheetRef}>
                <PurchaseOrderSheet doc={doc} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
