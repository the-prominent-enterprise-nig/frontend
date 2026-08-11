'use client'

import { useEffect, useState } from 'react'
import {
  ShieldCheck,
  ShieldOff,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  KeyRound,
  X,
  PackageCheck,
  Printer,
  AlertTriangle,
  History,
  ArrowLeft,
  FileSignature,
} from 'lucide-react'
import {
  getPendingReleaseFormRequests,
  getOwnReleaseFormRequests,
  getReleaseFormHistory,
  approveReleaseFormRequest,
  rejectReleaseFormRequest,
  validateManagerByPin,
} from '../../_actions/pos-actions'
import { signPromissoryNote } from '../../credit-applications/_actions/sign-promissory-note'
import type { PosReleaseFormRequest, PosReleaseFormCartLine } from '@/src/schema/pos'
import { PosDateTime } from '../../_components/PosDate'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { Skeleton } from '@/src/components/ui/Skeleton'

interface Props {
  isManager: boolean
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)
}

const statusBadge: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  approved: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  rejected: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  expired: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
}

const statusIcon: Record<string, React.ReactNode> = {
  pending: <Clock size={10} />,
  approved: <CheckCircle2 size={10} />,
  rejected: <XCircle size={10} />,
  cancelled: <XCircle size={10} />,
  expired: <XCircle size={10} />,
}

const requestTypeBadge: Record<string, string> = {
  RFD: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  'Application Form': 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  'RFD + Application Form': 'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200',
}

function RequestTypeBadge({ requestType }: { requestType?: string }) {
  const type = requestType ?? 'RFD'
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${requestTypeBadge[type] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {type}
    </span>
  )
}

/** The line the row/cards key off — first line flagged serial-tracked, or
 * failing that just the first line in the snapshot. */
function primaryLine(req: PosReleaseFormRequest): PosReleaseFormCartLine | undefined {
  const lines = req.cartSnapshot?.lines ?? []
  return lines.find((l) => l.serialNumberId) ?? lines[0]
}

function serialLabel(line?: PosReleaseFormCartLine): string {
  if (!line) return '—'
  return (
    line.serialNumberLabel ??
    line.serialNumber ??
    (line.serialNumberId ? '#' + line.serialNumberId.slice(0, 8) : '—')
  )
}

function shortId(id?: string | null): string {
  if (!id) return '—'
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

function cashierLabel(req: PosReleaseFormRequest): string {
  return req.requestedBy?.name ?? req.session?.cashier?.name ?? shortId(req.requestedById)
}

function branchTerminalLabel(req: PosReleaseFormRequest): string {
  const branch = req.session?.terminal?.branch?.name
  const terminal = req.session?.terminal?.terminalCode ?? req.session?.terminal?.name
  if (branch && terminal) return `${branch} · ${terminal}`
  return branch ?? terminal ?? shortId(req.sessionId)
}

function customerLabel(req: PosReleaseFormRequest): string {
  return (
    req.cartSnapshot?.customer?.name ??
    (req.cartSnapshot?.customerId ? shortId(req.cartSnapshot.customerId) : 'Walk-in')
  )
}

/** Scenario 17 Part 7 — mirrors the backend gate in
 * ReleaseFormRequestsService.approve(): an installment sale cannot be
 * released until every one of its Promissory Notes is signed. Frontend-only
 * UX guard; the backend is the real enforcement. Checked off the notes
 * themselves (not cartSnapshot.invoiceType, which per-line payment mode
 * usually leaves unset) — no notes means no installment line at all. */
function promissoryNoteBlocksRelease(req: PosReleaseFormRequest): boolean {
  const notes = req.promissoryNotes ?? []
  return notes.length > 0 && notes.some((n) => !n.signedAt)
}

function RequestRowSkeleton() {
  return (
    <tr>
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i} className="px-5 py-3">
          <Skeleton className="h-3.5 w-16" />
        </td>
      ))}
    </tr>
  )
}

export default function ReleaseApprovalsList({ isManager }: Props) {
  const { branchId } = usePosBranchContext()
  const [requests, setRequests] = useState<PosReleaseFormRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [detailTarget, setDetailTarget] = useState<PosReleaseFormRequest | null>(null)
  const [reviewTarget, setReviewTarget] = useState<PosReleaseFormRequest | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [approvalPin, setApprovalPin] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [reviewError, setReviewError] = useState('')
  // Scenario 17 Part 7 — signing from the detail modal, the only surface a
  // cashier can return to if they didn't sign the Promissory Note on the
  // checkout Pending Approval screen itself (that screen's state is lost on
  // navigation/refresh, so without this the sale would be stuck unsigned
  // forever).
  const [signingPromissoryNote, setSigningPromissoryNote] = useState(false)
  const [signPromissoryNoteError, setSignPromissoryNoteError] = useState('')

  // History view
  const [showHistory, setShowHistory] = useState(false)
  const [historyRequests, setHistoryRequests] = useState<PosReleaseFormRequest[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  async function load() {
    const res = isManager
      ? await getPendingReleaseFormRequests(branchId ?? undefined)
      : await getOwnReleaseFormRequests()
    if (res.success && res.data) {
      // Cashiers fetch their own requests of any status (there's no
      // branch-wide pending endpoint they're allowed to call) — the queue
      // here only shows the still-pending ones, matching what a manager
      // sees; resolved ones show up in History instead, same as a manager.
      setRequests(isManager ? res.data : res.data.filter((r) => r.status === 'pending'))
      setLoadError('')
    } else if (!res.success) {
      setLoadError(res.error ?? 'Failed to load release approvals.')
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 10_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId])

  async function loadHistory() {
    setHistoryLoading(true)
    const res = isManager
      ? await getReleaseFormHistory(branchId ?? undefined)
      : await getOwnReleaseFormRequests()
    if (res.success && res.data) {
      setHistoryRequests(isManager ? res.data : res.data.filter((r) => r.status !== 'pending'))
      setHistoryError('')
    } else if (!res.success) {
      setHistoryError(res.error ?? 'Failed to load history.')
    }
    setHistoryLoading(false)
  }

  function openHistory() {
    setShowHistory(true)
    loadHistory()
  }

  function closeHistory() {
    setShowHistory(false)
  }

  function openReview(req: PosReleaseFormRequest) {
    setDetailTarget(null)
    setReviewTarget(req)
    setReviewNotes('')
    setApprovalPin('')
    setReviewError('')
  }

  function closeReview() {
    setReviewTarget(null)
    setReviewNotes('')
    setApprovalPin('')
    setReviewError('')
  }

  /** Reuses the same window.open + window.print() pattern as the receipt
   * reprint flow (TransactionsList.tsx::handleReprint) — no server-side PDF
   * generation, just a styled, printable HTML document opened in a new tab. */
  function handlePrint(req: PosReleaseFormRequest) {
    const title =
      (req.requestType ?? 'RFD').toUpperCase() === 'RFD'
        ? 'RELEASE FORM DOCUMENT'
        : req.requestType === 'Application Form'
          ? 'APPLICATION FORM'
          : 'RELEASE FORM DOCUMENT + APPLICATION FORM'

    const lineRows = (req.cartSnapshot?.lines ?? [])
      .map(
        (l) =>
          `<tr><td>${l.itemName}${l.serialNumberId ? ` <span style="color:#888">(${serialLabel(l)})</span>` : ''}</td><td style="text-align:right">${l.quantity}</td><td style="text-align:right">&#8369;${l.unitPrice.toFixed(2)}</td></tr>`
      )
      .join('')

    const warningRows = (req.creditWarnings ?? []).map((w) => `<li>${w}</li>`).join('')

    const date = new Date(req.createdAt).toLocaleString('en-PH')
    const reviewedDate = req.reviewedAt ? new Date(req.reviewedAt).toLocaleString('en-PH') : null

    const html = `<!DOCTYPE html><html><head><title>${title} — ${req.id}</title>
<style>
  body{font-family:monospace;font-size:12px;max-width:420px;margin:0 auto;padding:16px}
  .banner{background:#000;color:#fff;text-align:center;padding:6px 0;font-size:14px;font-weight:bold;letter-spacing:2px;margin-bottom:10px}
  .center{text-align:center;margin:3px 0;color:#555}
  hr{border:none;border-top:1px dashed #aaa;margin:8px 0}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;color:#888;padding:2px 4px}
  td{padding:3px 4px}
  .row{display:flex;justify-content:space-between;padding:2px 0}
  .warn{background:#fef3c7;border:1px solid #fcd34d;border-radius:4px;padding:6px 10px;margin:8px 0;color:#92400e}
  .warn ul{margin:4px 0 0 16px;padding:0}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:10px}
  @media print{.no-print{display:none}}
</style></head><body>
<div class="banner">${title}</div>
<p class="center" style="font-weight:bold">${req.id}</p>
<p class="center">${date}</p>
<hr>
<div class="row"><span>Cashier</span><span>${cashierLabel(req)}</span></div>
<div class="row"><span>Branch / Terminal</span><span>${branchTerminalLabel(req)}</span></div>
<div class="row"><span>Customer</span><span>${customerLabel(req)}</span></div>
<hr>
<table><thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th></tr></thead><tbody>${lineRows}</tbody></table>
<hr>
<div class="row" style="font-weight:bold"><span>TOTAL</span><span>&#8369;${(req.cartSnapshot?.totalAmount ?? 0).toFixed(2)}</span></div>
${warningRows ? `<div class="warn"><strong>Credit/terms concerns</strong><ul>${warningRows}</ul></div>` : ''}
<hr>
<div class="row"><span>Status</span><span style="text-transform:capitalize">${req.status}</span></div>
${req.reviewedById ? `<div class="row"><span>Reviewed by</span><span>${shortId(req.reviewedById)}</span></div>` : ''}
${reviewedDate ? `<div class="row"><span>Reviewed at</span><span>${reviewedDate}</span></div>` : ''}
${req.reviewNotes ? `<div class="row"><span>Notes</span><span>${req.reviewNotes}</span></div>` : ''}
<p class="footer">${title}. Not a receipt.</p>
<button class="no-print" onclick="window.print()" style="display:block;margin:12px auto;padding:6px 20px;cursor:pointer;font-size:12px">Print</button>
</body></html>`

    const w = window.open('', '_blank', 'width=440,height=680,scrollbars=yes')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.focus()
      setTimeout(() => w.print(), 400)
    }
  }

  /** Scenario 17 Part 7 — same window.open + window.print() pattern as
   * handlePrint above, for one Promissory Note (per-line financing means a
   * request can have several — this prints one at a time). */
  function handlePrintPromissoryNote(
    note: NonNullable<PosReleaseFormRequest['promissoryNotes']>[number]
  ) {
    const lineRows = note.scheduleLines
      .map(
        (l) =>
          `<tr><td>${l.lineNumber}</td><td>${new Date(l.dueDate).toLocaleDateString('en-PH')}</td><td style="text-align:right">${formatCurrency(l.amount)}</td></tr>`
      )
      .join('')
    const generatedDate = new Date(note.generatedAt).toLocaleString('en-PH')
    const signedDate = note.signedAt ? new Date(note.signedAt).toLocaleString('en-PH') : null

    const html = `<!DOCTYPE html><html><head><title>PROMISSORY NOTE — ${note.id}</title>
<style>
  body{font-family:monospace;font-size:12px;max-width:420px;margin:0 auto;padding:16px}
  .banner{background:#000;color:#fff;text-align:center;padding:6px 0;font-size:14px;font-weight:bold;letter-spacing:2px;margin-bottom:10px}
  .center{text-align:center;margin:3px 0;color:#555}
  hr{border:none;border-top:1px dashed #aaa;margin:8px 0}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;color:#888;padding:2px 4px}
  td{padding:3px 4px}
  .row{display:flex;justify-content:space-between;padding:2px 0}
  .sig{margin-top:24px}
  .sig-line{border-top:1px solid #333;margin-top:36px;padding-top:4px;font-size:10px;color:#666}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:10px}
  @media print{.no-print{display:none}}
</style></head><body>
<div class="banner">PROMISSORY NOTE</div>
<p class="center" style="font-weight:bold">${note.id}</p>
<p class="center">Generated ${generatedDate}</p>
<hr>
<div class="row"><span>Financing term</span><span>${note.termMonths} months</span></div>
<div class="row"><span>Total amount</span><span>${formatCurrency(note.totalAmount)}</span></div>
<div class="row"><span>Down payment</span><span>${formatCurrency(note.downPayment)}</span></div>
<div class="row" style="font-weight:bold"><span>Amount financed</span><span>${formatCurrency(note.amountFinanced)}</span></div>
<div class="row" style="font-weight:bold"><span>Total payable</span><span>${formatCurrency(note.totalPayable)}</span></div>
<div class="row"><span>Monthly installment</span><span>${formatCurrency(note.monthlyInstallment)}</span></div>
<hr>
<table><thead><tr><th>#</th><th>Due date</th><th style="text-align:right">Amount</th></tr></thead><tbody>${lineRows}</tbody></table>
<hr>
<div class="row"><span>Status</span><span>${note.signedAt ? 'Signed' : 'Not yet signed'}</span></div>
${signedDate ? `<div class="row"><span>Signed at</span><span>${signedDate}</span></div>` : ''}
<div class="sig">
  <div class="sig-line">Applicant signature</div>
  <div class="sig-line">Co-maker signature</div>
</div>
<p class="footer">PROMISSORY NOTE. This document represents a binding commitment to pay per the schedule above.</p>
<button class="no-print" onclick="window.print()" style="display:block;margin:12px auto;padding:6px 20px;cursor:pointer;font-size:12px">Print</button>
</body></html>`

    const w = window.open('', '_blank', 'width=440,height=680,scrollbars=yes')
    if (w) {
      w.document.write(html)
      w.document.close()
      w.focus()
      setTimeout(() => w.print(), 400)
    }
  }

  async function handleSignPromissoryNote(req: PosReleaseFormRequest) {
    const firstNote = req.promissoryNotes?.[0]
    if (!firstNote) return
    setSigningPromissoryNote(true)
    setSignPromissoryNoteError('')
    const res = await signPromissoryNote(firstNote.creditApplicationId)
    setSigningPromissoryNote(false)
    if (!res.success) {
      setSignPromissoryNoteError(res.error ?? 'Failed to sign promissory note.')
      return
    }
    // Reflect the signed state immediately in the open modal, and refresh
    // the underlying list so the queue/history rows pick it up too.
    setDetailTarget((prev) =>
      prev && prev.id === req.id ? { ...prev, promissoryNotes: res.data } : prev
    )
    load()
  }

  async function handleApprove() {
    if (!reviewTarget) return
    if (!approvalPin.trim()) {
      setReviewError('Your PIN is required to approve.')
      return
    }
    setReviewing(true)
    setReviewError('')

    const pinRes = await validateManagerByPin(approvalPin.trim())
    if (!pinRes.success || !pinRes.data?.valid) {
      setReviewError(pinRes.error ?? 'Invalid PIN. Please try again.')
      setReviewing(false)
      return
    }

    const res = await approveReleaseFormRequest(reviewTarget.id, {
      reviewNotes: reviewNotes.trim() || `Approved by ${pinRes.data.managerName}`,
    })
    setReviewing(false)
    if (!res.success) {
      setReviewError(res.error ?? 'Failed to approve.')
      return
    }
    closeReview()
    load()
  }

  async function handleReject() {
    if (!reviewTarget) return
    if (!reviewNotes.trim()) {
      setReviewError('Please provide a reason for rejection.')
      return
    }
    if (!approvalPin.trim()) {
      setReviewError('Your PIN is required to reject.')
      return
    }
    setReviewing(true)
    setReviewError('')

    const pinRes = await validateManagerByPin(approvalPin.trim())
    if (!pinRes.success || !pinRes.data?.valid) {
      setReviewError(pinRes.error ?? 'Invalid PIN. Please try again.')
      setReviewing(false)
      return
    }

    const res = await rejectReleaseFormRequest(reviewTarget.id, { reviewNotes: reviewNotes.trim() })
    setReviewing(false)
    if (!res.success) {
      setReviewError(res.error ?? 'Failed to reject.')
      return
    }
    closeReview()
    load()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          {showHistory ? (
            <>
              <button
                onClick={closeHistory}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft size={15} />
                Back to Queue
              </button>
              <h1 className="mt-1 text-xl font-bold text-gray-900">
                Release &amp; Application Form History
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Approved and rejected release form requests.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900">
                Release &amp; Application Form Approvals
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Serial-tracked sales and credit (charge) sales awaiting manager approval before
                their invoice is created.
              </p>
            </>
          )}
        </div>
        {!showHistory && (
          <button
            onClick={openHistory}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <History size={13} />
            History
          </button>
        )}
      </div>

      {/* ── History view ─────────────────────────────────────────────────── */}
      {showHistory && (
        <>
          {historyError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {historyError}
            </div>
          )}
          {historyLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading history…
            </div>
          ) : historyRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-20 text-center">
              <History size={32} className="mb-3 text-gray-300" />
              <p className="font-medium text-gray-700">No history yet</p>
              <p className="mt-1 text-sm text-gray-400">
                Approved and rejected release form requests will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="scroll-fade-x overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {[
                        'Type',
                        'Item / Serial',
                        'Cashier',
                        'Branch / Terminal',
                        'Total',
                        'Customer',
                        'Status',
                        'Reviewed By',
                        'Reviewed At',
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {historyRequests.map((req) => {
                      const line = primaryLine(req)
                      return (
                        <tr
                          key={req.id}
                          onClick={() => setDetailTarget(req)}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="px-5 py-3">
                            <RequestTypeBadge requestType={req.requestType} />
                          </td>
                          <td className="px-5 py-3">
                            <p className="font-medium text-gray-900">{line?.itemName ?? '—'}</p>
                            <p className="font-mono text-[11px] text-gray-400">
                              {serialLabel(line)}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-gray-800">{cashierLabel(req)}</td>
                          <td className="px-5 py-3 text-gray-600">{branchTerminalLabel(req)}</td>
                          <td className="px-5 py-3 font-semibold text-gray-900">
                            {formatCurrency(req.cartSnapshot?.totalAmount ?? 0)}
                          </td>
                          <td className="px-5 py-3 text-gray-600">{customerLabel(req)}</td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${statusBadge[req.status] ?? ''}`}
                            >
                              {statusIcon[req.status]}
                              {req.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-600 text-sm">
                            {req.reviewedBy?.name ?? '—'}
                          </td>
                          <td className="px-5 py-3 text-gray-500 text-sm">
                            {req.reviewedAt ? <PosDateTime iso={req.reviewedAt} /> : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Pending view ─────────────────────────────────────────────────── */}
      {!showHistory && (
        <>
          {loadError && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
              {loadError}
            </div>
          )}

          {loading ? (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="scroll-fade-x overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {[
                        'Type',
                        'Item / Serial',
                        'Cashier',
                        'Branch / Terminal',
                        'Unit Price',
                        'Discount',
                        'Total',
                        'Customer',
                        'Submitted',
                        'Status',
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                        >
                          {h}
                        </th>
                      ))}
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <RequestRowSkeleton key={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-20 text-center">
              <PackageCheck size={32} className="mb-3 text-green-400" />
              <p className="font-medium text-gray-700">No pending release requests</p>
              <p className="mt-1 text-sm text-gray-400">
                All caught up. This page refreshes every 10 seconds.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="scroll-fade-x overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Type
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Item / Serial
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Cashier
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Branch / Terminal
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Unit Price
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Discount
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Total
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Customer
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Submitted
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Status
                      </th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {requests.map((req) => {
                      const line = primaryLine(req)
                      const extraLines = (req.cartSnapshot?.lines?.length ?? 1) - 1
                      return (
                        <tr
                          key={req.id}
                          onClick={() => setDetailTarget(req)}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="px-5 py-3">
                            <RequestTypeBadge requestType={req.requestType} />
                          </td>
                          <td className="px-5 py-3">
                            <p className="font-medium text-gray-900">
                              {line?.itemName ?? '—'}
                              {extraLines > 0 && (
                                <span className="ml-1 text-xs font-normal text-gray-400">
                                  +{extraLines} more
                                </span>
                              )}
                            </p>
                            <p className="font-mono text-[11px] text-gray-400">
                              {serialLabel(line)}
                            </p>
                          </td>
                          <td className="px-5 py-3 text-gray-800">{cashierLabel(req)}</td>
                          <td className="px-5 py-3 text-gray-600">{branchTerminalLabel(req)}</td>
                          <td className="px-5 py-3 text-gray-600">
                            {line ? formatCurrency(line.unitPrice) : '—'}
                          </td>
                          <td className="px-5 py-3 text-gray-600">
                            {formatCurrency(
                              req.cartSnapshot?.discountAmount ??
                                req.cartSnapshot?.discountTotal ??
                                0
                            )}
                          </td>
                          <td className="px-5 py-3 font-semibold text-gray-900">
                            {formatCurrency(req.cartSnapshot?.totalAmount ?? 0)}
                          </td>
                          <td className="px-5 py-3 text-gray-600">{customerLabel(req)}</td>
                          <td className="px-5 py-3 text-gray-500">
                            <PosDateTime iso={req.createdAt} />
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${statusBadge[req.status] ?? ''}`}
                            >
                              {statusIcon[req.status]}
                              {req.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right">
                            {isManager && req.status === 'pending' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openReview(req)
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 ring-1 ring-purple-200 hover:bg-purple-100 transition-colors"
                              >
                                <ShieldCheck size={11} /> Review
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Detail modal */}
      {detailTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDetailTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900">Release Form Request</h2>
                    <RequestTypeBadge requestType={detailTarget.requestType} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{detailTarget.id}</p>
                </div>
                <button
                  onClick={() => setDetailTarget(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>

              {(detailTarget.creditWarnings?.length ?? 0) > 0 && (
                <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Credit/terms concerns</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {detailTarget.creditWarnings!.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {(detailTarget.promissoryNotes?.length ?? 0) > 0 && (
                <div className="space-y-2 rounded-xl border border-purple-100 bg-purple-50/50 p-3">
                  <div className="flex items-center gap-2">
                    <FileSignature size={14} className="text-purple-700" />
                    <p className="text-sm font-semibold text-gray-800">
                      Promissory Note{(detailTarget.promissoryNotes?.length ?? 0) > 1 ? 's' : ''}
                    </p>
                    {detailTarget.promissoryNotes?.every((n) => n.signedAt) ? (
                      <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-green-700">
                        <CheckCircle2 size={11} /> Signed
                      </span>
                    ) : (
                      <span className="ml-auto text-xs font-medium text-red-600">
                        Not yet signed
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {detailTarget.promissoryNotes?.map((note, i) => (
                      <div key={note.id} className="flex items-center gap-2">
                        {(detailTarget.promissoryNotes?.length ?? 0) > 1 && (
                          <span className="shrink-0 text-[11px] text-gray-500">
                            Line {i + 1}
                            {note.signedAt && (
                              <CheckCircle2 size={11} className="ml-1 inline text-green-700" />
                            )}
                          </span>
                        )}
                        <button
                          onClick={() => handlePrintPromissoryNote(note)}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          <Printer size={12} /> Print
                        </button>
                      </div>
                    ))}
                    {detailTarget.promissoryNotes?.some((n) => !n.signedAt) && (
                      <button
                        onClick={() => handleSignPromissoryNote(detailTarget)}
                        disabled={signingPromissoryNote}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-800 disabled:opacity-50"
                      >
                        {signingPromissoryNote ? 'Signing…' : 'Mark as Signed'}
                      </button>
                    )}
                  </div>
                  {signPromissoryNoteError && (
                    <p className="text-xs text-red-600">{signPromissoryNoteError}</p>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${statusBadge[detailTarget.status] ?? ''}`}
                  >
                    {statusIcon[detailTarget.status]}
                    {detailTarget.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cashier</span>
                  <span className="text-gray-900 font-medium">{cashierLabel(detailTarget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Branch / Terminal</span>
                  <span className="text-gray-900">{branchTerminalLabel(detailTarget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer</span>
                  <span className="text-gray-900">{customerLabel(detailTarget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Submitted</span>
                  <span className="text-gray-700">
                    <PosDateTime iso={detailTarget.createdAt} />
                  </span>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-gray-500">Items</p>
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {(detailTarget.cartSnapshot?.lines ?? []).map((line, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-800">{line.itemName}</p>
                        {line.serialNumberId && (
                          <p className="font-mono text-[11px] text-gray-400">{serialLabel(line)}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right text-gray-600">
                        <p>
                          {line.quantity} × {formatCurrency(line.unitPrice)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
                  <span>Total</span>
                  <span>{formatCurrency(detailTarget.cartSnapshot?.totalAmount ?? 0)}</span>
                </div>
              </div>

              {detailTarget.reviewNotes && (
                <div>
                  <p className="mb-1 text-xs font-medium text-gray-500">Review notes</p>
                  <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 leading-relaxed">
                    {detailTarget.reviewNotes}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => handlePrint(detailTarget)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Printer size={13} /> Print
                </button>
                {isManager && detailTarget.status === 'pending' && (
                  <button
                    onClick={() => openReview(detailTarget)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                  >
                    <ShieldCheck size={13} /> Review
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Review modal — manager only */}
      {isManager && reviewTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => !reviewing && closeReview()}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">Review Release Request</h2>
                  <RequestTypeBadge requestType={reviewTarget.requestType} />
                </div>
                <p className="font-mono text-xs text-gray-500 mt-0.5">{reviewTarget.id}</p>
              </div>

              {(reviewTarget.creditWarnings?.length ?? 0) > 0 && (
                <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Credit/terms concerns</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-4">
                      {reviewTarget.creditWarnings!.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {(reviewTarget.promissoryNotes?.length ?? 0) > 0 && (
                <div
                  className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
                    reviewTarget.promissoryNotes?.every((n) => n.signedAt)
                      ? 'border-green-200 bg-green-50 text-green-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  <FileSignature size={15} className="shrink-0" />
                  <div>
                    <p className="font-medium">
                      {reviewTarget.promissoryNotes?.every((n) => n.signedAt)
                        ? `Promissory Note${(reviewTarget.promissoryNotes?.length ?? 0) > 1 ? 's' : ''} signed`
                        : `Promissory Note${(reviewTarget.promissoryNotes?.length ?? 0) > 1 ? 's' : ''} not yet signed`}
                    </p>
                    {!reviewTarget.promissoryNotes?.every((n) => n.signedAt) && (
                      <p className="text-xs opacity-90">
                        Release is blocked until the cashier prints it for the customer/co-maker and
                        marks it signed.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Cashier</span>
                  <span className="text-gray-900 font-medium">{cashierLabel(reviewTarget)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Item / Serial</span>
                  <span className="text-gray-700 text-right">
                    {primaryLine(reviewTarget)?.itemName ?? '—'} ·{' '}
                    {serialLabel(primaryLine(reviewTarget))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(reviewTarget.cartSnapshot?.totalAmount ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Requested</span>
                  <span className="text-gray-700">
                    <PosDateTime iso={reviewTarget.createdAt} />
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Notes <span className="text-gray-400">(required for rejection)</span>
                </label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 resize-none"
                  placeholder="Add notes…"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  disabled={reviewing}
                />
              </div>

              <div className="rounded-xl border border-purple-100 bg-purple-50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <KeyRound size={13} className="text-purple-600" />
                  <p className="text-xs font-semibold text-purple-700">
                    Manager / Owner PIN required
                  </p>
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono tracking-widest text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                  placeholder="••••"
                  value={approvalPin}
                  onChange={(e) => setApprovalPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleApprove()}
                  disabled={reviewing}
                />
              </div>

              {reviewError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{reviewError}</p>
              )}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={closeReview}
                  disabled={reviewing}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={reviewing || !approvalPin.trim()}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {reviewing ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <ShieldOff size={13} />
                  )}
                  Reject
                </button>
                <button
                  onClick={handleApprove}
                  disabled={
                    reviewing || !approvalPin.trim() || promissoryNoteBlocksRelease(reviewTarget)
                  }
                  title={
                    promissoryNoteBlocksRelease(reviewTarget)
                      ? 'The Promissory Note must be signed before this sale can be released.'
                      : undefined
                  }
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {reviewing ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={13} />
                  )}
                  Approve & Release
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
