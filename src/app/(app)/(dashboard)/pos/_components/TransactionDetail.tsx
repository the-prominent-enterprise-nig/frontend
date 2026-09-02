'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useVoidRequests, useSubmitVoidRequest, useSessions } from '../_hooks/usePos'
import { X, Loader2, FileText, Clock, CheckCircle, XCircle, Undo2 } from 'lucide-react'
import { getTransaction, getCustomerById, createTransaction } from '../_actions/pos-actions'
import type { PosTransaction, PosVoidRequest } from '@/src/schema/pos'
import { isRefundPendingApproval } from '@/src/schema/pos'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { usePosPendingRefundStore } from '@/src/stores/pos-pending-refund.store'
import { PosDateTime } from './PosDate'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { type SessionUser, can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { showToast } from '@/src/components/ui/toast'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

const voidReqStatusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

const voidReqStatusIcon: Record<string, React.ReactNode> = {
  pending: <Clock size={13} />,
  approved: <CheckCircle size={13} />,
  rejected: <XCircle size={13} />,
}

export function TransactionDetail({
  transaction: summary,
  session,
  onClose,
  canVoid,
  canRefund,
  onVoid,
  onRefunded,
}: {
  transaction: PosTransaction
  session: SessionUser
  onClose: () => void
  canVoid?: boolean
  canRefund?: boolean
  onVoid?: () => void
  onRefunded?: () => void
}) {
  const canRequestVoid = can(session, POS_PERMISSIONS.TRANSACTIONS_VOID)

  const { data: detailRes, isLoading: detailLoading } = useQuery({
    queryKey: ['pos-transaction', summary.id],
    queryFn: () => getTransaction(summary.id),
    staleTime: 60 * 1000,
  })
  const tx: PosTransaction = detailRes?.data ?? summary

  const { data: customerRes } = useQuery({
    queryKey: ['pos-transaction-customer', tx.customerId],
    queryFn: () => getCustomerById(tx.customerId!),
    enabled: !!tx.customerId,
    staleTime: 5 * 60 * 1000,
  })
  const customerName = customerRes?.data
    ? customerRes.data.name ||
      `${customerRes.data.firstName ?? ''} ${customerRes.data.lastName ?? ''}`.trim() ||
      null
    : null

  const [activeTab, setActiveTab] = useState<'details' | 'void-requests'>('details')
  const [showRefund, setShowRefund] = useState(false)
  const isRefundable = tx.transactionType === 'sale' && tx.status === 'completed'

  const { data: voidReqRes, isLoading: voidReqLoading } = useVoidRequests(tx.id)
  const voidRequests: PosVoidRequest[] = voidReqRes?.data ?? []
  const hasPendingRequest = voidRequests.some((r) => r.status === 'pending')

  const submitVoidMutation = useSubmitVoidRequest()
  const [voidReason, setVoidReason] = useState('')
  const [submitErr, setSubmitErr] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)

  async function handleSubmitVoidRequest(): Promise<void> {
    setSubmitErr('')
    const res = await submitVoidMutation.mutateAsync({
      transactionId: tx.id,
      input: { reason: voidReason, requestType: 'void' },
    })
    if (!res.success) {
      setSubmitErr(res.error ?? 'Failed to submit void request')
      return
    }
    setVoidReason('')
    setSubmitSuccess(true)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
          >
            <X size={18} />
          </button>
          <h2 className="mb-1 text-lg font-bold text-gray-900">{tx.transactionNumber}</h2>
          <p className="mb-4 text-sm text-gray-500 capitalize">
            {tx.transactionType} · {tx.status}
          </p>

          {/* Tab switcher */}
          <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'details'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('void-requests')}
              className={`relative flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'void-requests'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Void Requests
              {hasPendingRequest && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-yellow-400" />
              )}
            </button>
          </div>

          {/* ── Details tab ── */}
          {activeTab === 'details' && (
            <>
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Items</p>
                {detailLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex animate-pulse gap-3">
                        <div className="h-3.5 w-1/2 rounded bg-gray-200" />
                        <div className="h-3.5 w-8 rounded bg-gray-200" />
                        <div className="ml-auto h-3.5 w-16 rounded bg-gray-200" />
                      </div>
                    ))}
                  </div>
                ) : tx.lines && tx.lines.length > 0 ? (
                  <table className="w-full table-fixed text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
                        <th className="w-auto pb-1">Item</th>
                        <th className="w-12 pb-1 pl-2 text-right">Qty</th>
                        <th className="w-24 pb-1 pl-2 text-right">Unit Price</th>
                        <th className="w-24 pb-1 pl-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tx.lines.map((l) => (
                        <tr key={l.id}>
                          <td className="py-1.5 pr-2 text-gray-800">
                            {l.itemName}
                            {l.serialNumber && (
                              <p className="font-mono text-[10px] text-purple-500">
                                SN: {l.serialNumber}
                                {l.secondarySerialNumber && ` / ${l.secondarySerialNumber}`}
                              </p>
                            )}
                          </td>
                          <td className="py-1.5 pl-2 text-right text-gray-600">{l.quantity}</td>
                          <td className="py-1.5 pl-2 text-right text-gray-600">
                            {formatCurrency(l.unitPrice)}
                          </td>
                          <td className="py-1.5 pl-2 text-right font-medium text-gray-900">
                            {formatCurrency(l.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-gray-400">No items found.</p>
                )}
              </div>

              <div className="rounded-xl bg-gray-50 p-4 text-sm space-y-1">
                <Row label="Subtotal" value={formatCurrency(tx.subtotal)} />
                {(() => {
                  const scPwd = tx.scPwdDiscountTotal ?? 0
                  const otherDiscount = tx.discountTotal - scPwd
                  return (
                    <>
                      {otherDiscount > 0 && (
                        <Row label="Discount" value={`-${formatCurrency(otherDiscount)}`} />
                      )}
                      {tx.scPwdDiscountType && scPwd > 0 && (
                        <Row
                          label={`${tx.scPwdDiscountType} Discount (${tx.scPwdName ?? ''} / ${tx.scPwdIdNumber ?? ''})`}
                          value={`-${formatCurrency(scPwd)}`}
                        />
                      )}
                    </>
                  )
                })()}
                {/* BIR CAS: all 4 VAT labels always shown when breakdown exists, even at ₱0.00 */}
                {tx.vatableAmount != null ||
                tx.vatExemptAmount != null ||
                tx.zeroRatedAmount != null ? (
                  <>
                    <Row
                      label="VATable Sales (12%)"
                      value={formatCurrency(tx.vatableAmount ?? 0)}
                      muted
                    />
                    <Row
                      label="VAT-Exempt Sales"
                      value={formatCurrency(tx.vatExemptAmount ?? 0)}
                      muted
                    />
                    <Row
                      label="Zero-Rated Sales"
                      value={formatCurrency(tx.zeroRatedAmount ?? 0)}
                      muted
                    />
                    <Row label="VAT Amount (12%)" value={formatCurrency(tx.taxTotal)} muted />
                  </>
                ) : tx.taxTotal > 0 ? (
                  <Row label="Tax" value={formatCurrency(tx.taxTotal)} />
                ) : null}
                {tx.session?.terminal?.branch?.name && (
                  <Row label="Branch" value={tx.session.terminal.branch.name} />
                )}
                {customerName && <Row label="Customer" value={customerName} />}
                {tx.sellingAgent && <Row label="Selling Agent" value={tx.sellingAgent.name} />}
                {tx.salesInvoiceNumber && <Row label="SI Number" value={tx.salesInvoiceNumber} />}
                {tx.deliveryReceiptNumber && (
                  <Row label="DR Number" value={tx.deliveryReceiptNumber} />
                )}
                <div className="border-t border-gray-200 pt-2">
                  <Row label="Total" value={formatCurrency(tx.totalAmount)} bold />
                </div>
              </div>

              {tx.payments && tx.payments.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Payments</p>
                  {tx.payments.map((p) => (
                    <div key={p.id} className="flex justify-between gap-2 py-1 text-sm">
                      <span className="capitalize text-gray-600">
                        {p.paymentMethod.replace('_', ' ')}
                        {p.referenceNumber && (
                          <span className="block font-mono text-[10px] normal-case text-gray-400">
                            CR# {p.referenceNumber}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-medium text-gray-900">
                        {formatCurrency(p.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Scenario 23 Gap 1 — invoice(s) this transaction produced,
                  one row per invoice (developer-confirmed UI convention). A
                  charge sale has exactly one; an installment sale has one
                  per due date per financing term used. */}
              {tx.invoices && tx.invoices.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Invoices</p>
                  <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                    {tx.invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-mono text-xs text-gray-700">{inv.invoiceNumber}</p>
                          <p className="text-[11px] text-gray-400">
                            {inv.source === 'charge'
                              ? 'Charge invoice'
                              : `Installment ${inv.lineNumber}/${inv.totalLines} · ${inv.termMonths} mo · due ${new Date(inv.dueDate).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {formatCurrency(inv.totalAmount)}
                          </span>
                          <InvoiceStatusBadge status={inv.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canRefund && isRefundable && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setShowRefund(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-medium text-orange-700 hover:bg-orange-100"
                  >
                    <Undo2 size={12} />
                    Refund
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Void Requests tab ── */}
          {activeTab === 'void-requests' && (
            <div className="space-y-3">
              {voidReqLoading ? (
                <div className="space-y-3 py-2">
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
                  ))}
                </div>
              ) : voidRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-gray-400">
                  <FileText size={32} strokeWidth={1} />
                  <p className="text-sm">No void requests yet.</p>
                </div>
              ) : (
                voidRequests.map((req) => (
                  <div key={req.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800">{req.reason}</p>
                        {req.reviewNotes && (
                          <p className="mt-1 text-xs text-gray-500 italic">
                            Reviewer note: {req.reviewNotes}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-gray-400">
                          Submitted <PosDateTime iso={req.createdAt} />
                        </p>
                      </div>
                      <span
                        className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${voidReqStatusColor[req.status]}`}
                      >
                        {voidReqStatusIcon[req.status]}
                        {req.status}
                      </span>
                    </div>
                  </div>
                ))
              )}

              {/* Submit form — only for completed transactions with no pending request */}
              {canRequestVoid &&
                tx.status === 'completed' &&
                !hasPendingRequest &&
                !submitSuccess && (
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase text-gray-500">
                      Request Void
                    </p>
                    <textarea
                      className="input w-full resize-none"
                      placeholder="Reason for void request…"
                      rows={3}
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                    />
                    {submitErr && <p className="mt-2 text-xs text-red-600">{submitErr}</p>}
                    <button
                      onClick={handleSubmitVoidRequest}
                      disabled={submitVoidMutation.isPending || !voidReason.trim()}
                      className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {submitVoidMutation.isPending ? 'Submitting…' : 'Submit Void Request'}
                    </button>
                  </div>
                )}

              {submitSuccess && (
                <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  Void request submitted — pending manager review.
                </p>
              )}

              {hasPendingRequest && (
                <p className="rounded-lg bg-yellow-50 px-4 py-3 text-xs text-yellow-700">
                  A void request is already pending manager review.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {showRefund && (
        <RefundModal
          transaction={tx}
          session={session}
          onClose={() => setShowRefund(false)}
          onSubmitted={() => {
            setShowRefund(false)
            onRefunded?.()
            onClose()
          }}
        />
      )}
    </>
  )
}

/** Full-transaction refund — the only refund flow this queue currently
 * supports; per-line/partial refunds are a future enhancement. Posts a
 * `transactionType: 'refund'` transaction against the current cashier's open
 * session, referencing the original sale via `originalTransactionId`. Under
 * the new unified ReturnRefundRequest model this always defers to manager
 * approval instead of completing instantly. */
function RefundModal({
  transaction,
  session,
  onClose,
  onSubmitted,
}: {
  transaction: PosTransaction
  session: SessionUser
  onClose: () => void
  onSubmitted: () => void
}) {
  const { branchId } = usePosBranchContext()
  const { data: openSessionsRes, isLoading: sessionsLoading } = useSessions({
    status: 'open',
    branchId: branchId ?? undefined,
  })
  const openSessions = openSessionsRes?.data ?? []

  const [sessionId, setSessionId] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionId && openSessions.length === 1) setSessionId(openSessions[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSessions.length])

  async function handleSubmit() {
    if (!sessionId) {
      setError('Select an open POS session to post the refund against.')
      return
    }
    if (!reason.trim()) {
      setError('A reason for the refund is required.')
      return
    }
    setSubmitting(true)
    setError('')

    const lines = (transaction.lines ?? []).map((l) => ({
      itemId: l.itemId,
      itemName: l.itemName,
      sku: l.sku ?? undefined,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountAmount: l.discountAmount,
      taxAmount: l.taxAmount,
      notes: l.notes ?? undefined,
    }))

    const res = await createTransaction({
      sessionId,
      transactionType: 'refund',
      originalTransactionId: transaction.id,
      customerId: transaction.customerId ?? undefined,
      subtotal: transaction.subtotal,
      totalAmount: transaction.totalAmount,
      discountAmount: transaction.discountTotal,
      taxAmount: transaction.taxTotal,
      currency: transaction.currency,
      reason: reason.trim(),
      lines,
    })

    if (!res.success || !res.data) {
      setError(res.error ?? 'Failed to submit refund.')
      setSubmitting(false)
      return
    }

    if (isRefundPendingApproval(res.data)) {
      const { returnRefundRequestId, sessionId: refundSessionId } = res.data
      const itemNameSummary =
        transaction.lines && transaction.lines.length === 1
          ? transaction.lines[0].itemName
          : `${transaction.transactionNumber} (${transaction.lines?.length ?? 0} items)`

      usePosPendingRefundStore.getState().add({
        returnRefundRequestId,
        itemName: itemNameSummary,
        totalAmount: transaction.totalAmount,
        submittedAt: new Date().toISOString(),
        sessionId: refundSessionId,
        submittedByUserId: session.id,
      })

      showToast({
        title: 'Refund submitted',
        description: `${transaction.transactionNumber} — pending manager approval before funds are released.`,
        status: 'info',
      })
      setSubmitting(false)
      onSubmitted()
      return
    }

    // Defensive fallback — the unified model always defers refunds to
    // approval, but if a completed transaction ever comes back, don't strand
    // the cashier on a stuck "submitting" state.
    showToast({ title: 'Refund completed', status: 'success' })
    setSubmitting(false)
    onSubmitted()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={() => !submitting && onClose()} />
      <div className="fixed inset-0 z-51 flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <Undo2 size={18} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Refund Transaction</h2>
              <p className="font-mono text-xs text-gray-500">{transaction.transactionNumber}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
              Refunds the full amount of this transaction (
              {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
                transaction.totalAmount
              )}
              ). Submitting creates a return/refund request — funds are released only after a
              manager approves it.
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                Post refund against session
              </label>
              {sessionsLoading ? (
                <Skeleton className="h-9 w-full rounded-lg" />
              ) : openSessions.length === 0 ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  No open POS session found for this branch. Open a session before processing a
                  refund.
                </p>
              ) : (
                <select
                  className="select w-full"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Select a session…</option>
                  {openSessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {(s.terminal?.name ?? s.terminal?.terminalCode ?? 'Terminal') +
                        (s.cashier?.name ? ` · ${s.cashier.name}` : '')}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">
                Reason <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                placeholder="e.g. Customer returned item"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !sessionId}
              className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Submitting…
                </>
              ) : (
                'Submit Refund Request'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={`flex justify-between ${bold ? 'font-bold text-gray-900' : muted ? 'text-gray-400 text-xs' : 'text-gray-600'}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

// Scenario 23 Gap 1 — same status vocabulary/styling as Customer360's
// InstallmentStatusBadge (crm/customers/[id]/_components/Customer360.tsx),
// kept as a local copy rather than a cross-module import (POS importing
// from a CRM page component would be the wrong dependency direction).
const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SENT: 'Due',
  PARTIAL: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  CANCELLED: 'Cancelled',
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PAID: 'bg-green-100 text-green-700',
    PARTIAL: 'bg-amber-100 text-amber-700',
    OVERDUE: 'bg-red-100 text-red-700',
    SENT: 'bg-gray-100 text-gray-600',
    DRAFT: 'bg-gray-100 text-gray-500',
    CANCELLED: 'bg-gray-100 text-gray-400',
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {INVOICE_STATUS_LABELS[status] ?? status}
    </span>
  )
}
