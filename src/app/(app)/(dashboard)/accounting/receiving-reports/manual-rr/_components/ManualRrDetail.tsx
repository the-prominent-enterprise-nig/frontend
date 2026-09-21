'use client'

/* Scenario 53 — rebuilt into a multi-line, draft-then-post view: no more
 * approve/reject (there's no second-approver requirement anymore — the
 * same person who created the draft can post it themselves whenever
 * ready). Same #5b21b6 "receiving family" design language as
 * ManualRrForm.tsx (see its own doc comment for the fuller rationale). A
 * routed page, not a modal — developer feedback, third occurrence in this
 * codebase (see feedback_no_modals_use_pages memory): Scenario 40
 * (Expenses) and Scenario 41 (AP Bills, BillForm.tsx's own comment) already
 * converted their create/detail modals to full pages for the same reason.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import {
  MANUAL_RR_STATUS_LABELS,
  MANUAL_RR_TAX_CODES,
  MANUAL_RR_WITHHOLDING_CLASSES,
  type ManualReceivingReport,
} from '@/src/schema/inventory/manual-receiving-reports'
import { PLEX, MONO } from '../../../../inventory/purchase-orders/_components/procurementTokens'
import { PANEL } from '../../../../inventory/purchase-orders/_components/receive-po/receiveTokens'
import { getManualReceivingReport } from '../../../../inventory/manual-receiving-reports/_actions/get-manual-receiving-report'
import { postManualReceivingReport } from '../../../../inventory/manual-receiving-reports/_actions/post-manual-receiving-report'
import { deleteManualReceivingReport } from '../../../../inventory/manual-receiving-reports/_actions/delete-manual-receiving-report'
import { showToast } from '@/src/components/ui/toast'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-[#fdf2d9] text-[#8a5b00]',
  posted: 'bg-[#e3f6e8] text-[#0e7a3a]',
}

const money = (v: string | number) =>
  Number(v).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })

const taxCodeLabel = (code?: string | null) =>
  MANUAL_RR_TAX_CODES.find((c) => c.value === code)?.label

const withholdingClassLabel = (cls?: string | null) =>
  MANUAL_RR_WITHHOLDING_CLASSES.find((c) => c.value === cls)?.label

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[11px] text-[#8b8b9b]">{label}</span>
      <span className={`text-[13px] text-[#17171c] ${mono ? MONO : ''}`}>{value}</span>
    </div>
  )
}

export default function ManualRrDetail({ id }: { id: string }) {
  const [report, setReport] = useState<ManualReceivingReport | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPosting, setIsPosting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const load = () =>
    getManualReceivingReport(id).then((res) => {
      if (res.success && res.data) setReport(res.data)
      else setLoadError(res.message || res.error || 'Manual receiving report not found.')
    })

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handlePost() {
    setIsPosting(true)
    const result = await postManualReceivingReport(report!.id)
    setIsPosting(false)
    if (result.success) {
      showToast({ title: 'Posted', description: result.message, status: 'success' })
      load()
    } else {
      showToast({ title: 'Failed', description: result.message, status: 'error' })
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return
    setIsDeleting(true)
    const result = await deleteManualReceivingReport(report!.id)
    setIsDeleting(false)
    if (result.success) {
      showToast({ title: 'Draft deleted', description: result.message, status: 'success' })
      window.location.href = '/accounting/receiving-reports'
    } else {
      showToast({ title: 'Failed', description: result.message, status: 'error' })
    }
  }

  const header = (breadcrumbTail: string, title: string, subtitle: string) => (
    <div className="flex shrink-0 flex-wrap items-start justify-between gap-5 border-b border-[#e4e4e9] bg-white px-4 py-3.5 lg:px-5">
      <div className="flex min-w-0 flex-col gap-1">
        <div className={`${MONO} text-[10.5px] uppercase tracking-[.08em] text-[#a3a3b2]`}>
          Accounting › Receiving Reports › {breadcrumbTail}
        </div>
        <h2 className="text-[21px] font-semibold tracking-[-.02em]">{title}</h2>
        <p className="text-[12.5px] text-[#5b5b6b]">{subtitle}</p>
      </div>
    </div>
  )

  if (loadError) {
    return (
      <div className={`${PLEX} flex min-h-screen flex-col bg-[#f2f2f3] text-[#17171c]`}>
        {header('Manual RR', 'Manual Receiving Report', 'Not found')}
        <div className="mx-auto w-full max-w-[1320px] px-3.5 py-4 lg:px-5">
          <Link
            href="/accounting/receiving-reports"
            className="text-[13px] text-[#5b21b6] hover:underline"
          >
            ← Back to Receiving Reports
          </Link>
          <p className="mt-3 text-[13px] text-[#b42318]">{loadError}</p>
        </div>
      </div>
    )
  }
  if (!report) {
    return (
      <div className={`${PLEX} flex min-h-screen flex-col bg-[#f2f2f3] text-[#17171c]`}>
        {header('Manual RR', 'Manual Receiving Report', 'Loading…')}
      </div>
    )
  }

  const isDraft = report.status === 'draft'
  const totalUnits = report.lines.reduce((sum, l) => sum + Number(l.quantityReceived), 0)

  return (
    <div className={`${PLEX} flex min-h-screen flex-col bg-[#f2f2f3] text-[#17171c]`}>
      {header(report.code, report.code, 'Manual receiving report — no PO/transfer/count context')}

      <div className="mx-auto flex w-full max-w-[1320px] flex-1 flex-col gap-3.5 px-3.5 py-4 lg:px-5">
        <div className={`${PANEL} flex flex-col overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-4.5 py-2.5">
            <span className="text-[13.5px] font-semibold">Delivery details</span>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${STATUS_COLORS[report.status]}`}
            >
              {MANUAL_RR_STATUS_LABELS[report.status]}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 px-4.5 pb-4 pt-3.5 sm:grid-cols-2 xl:grid-cols-3">
            <InfoRow
              label="Location"
              value={report.warehouse.branch?.name ?? report.warehouse.name}
            />
            {report.receivedAt && (
              <InfoRow
                label="Date Received"
                value={new Date(report.receivedAt).toLocaleDateString('en-PH')}
              />
            )}
            {report.deliveryReceiptNumber && (
              <InfoRow label="Delivery Receipt No." value={report.deliveryReceiptNumber} mono />
            )}
            {report.supplierInvoiceNumber && (
              <InfoRow label="Supplier Invoice No." value={report.supplierInvoiceNumber} mono />
            )}
            {report.poNumber && <InfoRow label="PO Number" value={report.poNumber} mono />}
            {(report.supplier || report.newSourceName) && (
              <InfoRow
                label="Source"
                value={
                  report.supplier
                    ? `${report.supplier.code} — ${report.supplier.name}`
                    : (report.newSourceName ?? '—')
                }
              />
            )}
            <InfoRow label="Created By" value={report.createdByName ?? report.createdById} />
          </div>

          {report.notes && (
            <div className="border-t border-[#eeeef1] px-4.5 py-3.5">
              <InfoRow label="Notes" value={report.notes} />
            </div>
          )}
        </div>

        <div className={`${PANEL} flex flex-col overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeef1] px-4.5 py-2.5">
            <span className="text-[13.5px] font-semibold">Items</span>
            <span className={`${MONO} text-[11px] text-[#8b8b9b]`}>
              {report.lines.length} {report.lines.length === 1 ? 'line' : 'lines'} · {totalUnits}{' '}
              units
            </span>
          </div>
          <div
            className={`${MONO} hidden grid-cols-[1fr_80px_100px_100px_1fr] items-end gap-x-4 border-b border-[#eeeef1] bg-[#fbfbfc] px-4.5 py-2.5 text-[10px] uppercase tracking-[.09em] text-[#8b8b9b] lg:grid`}
          >
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Unit Cost</span>
            <span className="text-right">Line Total</span>
            <span>Serials</span>
          </div>
          {report.lines.map((line) => {
            const qty = Number(line.quantityReceived)
            const unitCost = line.unitCost != null ? Number(line.unitCost) : null
            const total = line.isFreebie ? 0 : (unitCost ?? 0) * qty
            return (
              <div
                key={line.id}
                className="grid grid-cols-1 gap-x-4 gap-y-1 border-b border-[#eeeef1] px-4.5 py-3 last:border-b-0 lg:grid-cols-[1fr_80px_100px_100px_1fr] lg:items-center"
              >
                <span className="text-[13px] text-[#17171c]">
                  {line.item ? `${line.item.name} (${line.item.sku})` : line.newItemName}
                  {line.isFreebie && (
                    <span className="ml-1.5 rounded-full bg-[#f1ebfb] px-1.5 py-0.5 text-[10px] font-medium text-[#3f1490]">
                      FREE
                    </span>
                  )}
                  {line.taxCode && taxCodeLabel(line.taxCode) && (
                    <span className="ml-1.5 rounded-full bg-[#f1f1f4] px-1.5 py-0.5 text-[10px] font-medium text-[#5b5b6b]">
                      {taxCodeLabel(line.taxCode)}
                    </span>
                  )}
                  {line.withholdingClass && withholdingClassLabel(line.withholdingClass) && (
                    <span className="ml-1.5 rounded-full bg-[#f1f1f4] px-1.5 py-0.5 text-[10px] font-medium text-[#5b5b6b]">
                      {withholdingClassLabel(line.withholdingClass)}
                    </span>
                  )}
                </span>
                <span className={`${MONO} text-[13px] text-[#17171c] lg:text-right`}>{qty}</span>
                <span className={`${MONO} text-[13px] text-[#17171c] lg:text-right`}>
                  {unitCost != null ? money(unitCost) : '—'}
                </span>
                <span className={`${MONO} text-[13px] text-[#17171c] lg:text-right`}>
                  {unitCost != null || line.isFreebie ? money(total) : '—'}
                </span>
                <span className={`${MONO} truncate text-[12px] text-[#5b5b6b]`}>
                  {line.serialNumbers && line.serialNumbers.length > 0
                    ? line.serialNumbers.join(', ')
                    : '—'}
                </span>
              </div>
            )
          })}
        </div>

        {report.status === 'posted' && (
          <div className={`${PANEL} flex flex-col gap-2 bg-[#f4fbf6] px-4.5 py-3.5`}>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
              <InfoRow label="Posted By" value={report.postedByName ?? report.postedById ?? '—'} />
              {report.postedAt && (
                <InfoRow
                  label="Posted At"
                  value={new Date(report.postedAt).toLocaleString('en-PH')}
                />
              )}
              {report.vatAmount != null && (
                <InfoRow label="Input VAT" mono value={money(report.vatAmount)} />
              )}
              {report.withheldAmount != null && (
                <InfoRow label="Withheld" mono value={money(report.withheldAmount)} />
              )}
            </div>
            {report.journalEntryId ? (
              <p className="mt-1 text-[12px] text-[#0e7a3a]">
                Journal entry posted (Dr Inventory{report.vatAmount ? ' / Dr Input VAT' : ''} / Cr
                AP{report.withheldAmount ? ' / Cr WHT Payable' : ''}).
              </p>
            ) : (
              <p className="mt-1 text-[12px] text-[#5b5b6b]">
                No unit cost was given on any line — this delivery has no financial value.
              </p>
            )}
            {report.apBillId && (
              <p className="text-[12px] text-[#0e7a3a]">
                A draft AP bill was scaffolded from this receipt.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-40 flex flex-wrap items-center justify-between gap-3.5 border-t border-[#e4e4e9] bg-white px-4 py-3 shadow-[0_-8px_24px_-16px_rgba(20,20,30,.3)] lg:px-5">
        <Link
          href="/accounting/receiving-reports"
          className="rounded-lg px-4 py-2 text-[13px] font-medium text-[#5b5b6b] hover:bg-[#f1f1f4]"
        >
          ← Back to Receiving Reports
        </Link>
        {isDraft && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-lg border border-[#f3c9c5] px-4 py-2 text-[13px] font-medium text-[#b42318] hover:bg-[#fdeceb] disabled:opacity-60"
            >
              {isDeleting ? 'Deleting…' : 'Delete Draft'}
            </button>
            <button
              type="button"
              onClick={handlePost}
              disabled={isPosting}
              className="flex items-center gap-1.5 rounded-lg bg-[#5b21b6] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#4a189b] disabled:opacity-60"
            >
              {isPosting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Post
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
