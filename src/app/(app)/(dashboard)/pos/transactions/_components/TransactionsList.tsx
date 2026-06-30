'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useTransactions,
  useVoidTransaction,
  useSendReceipt,
  useVoidRequests,
  useSubmitVoidRequest,
} from '../../_hooks/usePos'
import {
  RefreshCw,
  ShoppingCart,
  X,
  Search,
  ChevronDown,
  Mail,
  Printer,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { getReceipt, logReprintEvent, getTransaction } from '../../_actions/pos-actions'
import type { PosTransaction, PosVoidRequest } from '@/src/schema/pos'
import { PosDateTime } from '../../_components/PosDate'
import { type SessionUser, can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'

const typeColor: Record<string, string> = {
  sale: 'bg-blue-100 text-blue-700',
  refund: 'bg-orange-100 text-orange-700',
  exchange: 'bg-purple-100 text-purple-700',
}

const statusColor: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  voided: 'bg-red-100 text-red-700',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

type DetailModal = { type: 'none' } | { type: 'detail'; transaction: PosTransaction }

interface Props {
  session: SessionUser
}

export default function TransactionsList({ session }: Props) {
  const canVoid = can(session, POS_PERMISSIONS.TRANSACTIONS_OVERRIDE)

  const [filters, setFilters] = useState({
    transactionType: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    transactionNumber: '',
  })
  const [applied, setApplied] = useState(filters)
  const [detail, setDetail] = useState<DetailModal>({ type: 'none' })
  const [voidTarget, setVoidTarget] = useState<PosTransaction | null>(null)
  const [voidError, setVoidError] = useState('')

  useEffect(() => {
    if (!voidTarget) setVoidError('')
  }, [voidTarget])

  const { data, isLoading, isFetching, refetch } = useTransactions(
    Object.fromEntries(Object.entries(applied).filter(([, v]) => v !== '')) as Record<
      string,
      string
    >
  )
  const voidMutation = useVoidTransaction()

  const transactions: PosTransaction[] = data?.data ?? []

  async function handleVoid() {
    if (!voidTarget) return
    setVoidError('')
    try {
      const res = await voidMutation.mutateAsync(voidTarget.id)
      if (!res.success) {
        setVoidError(res.error ?? 'Failed to void transaction')
        return
      }
      setVoidTarget(null)
    } catch (err) {
      setVoidError(err instanceof Error ? err.message : 'Failed to void transaction')
    }
  }

  return (
    <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
            <p className="mt-1 text-sm text-gray-500">All sales, refunds, and exchanges.</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex-1 min-w-48">
            <label className="mb-1 block text-xs font-semibold text-gray-600">Transaction #</label>
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                className="input"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="Search…"
                value={filters.transactionNumber}
                onChange={(e) => setFilters((p) => ({ ...p, transactionNumber: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Type</label>
            <div className="relative">
              <select
                className="select"
                value={filters.transactionType}
                onChange={(e) => setFilters((p) => ({ ...p, transactionType: e.target.value }))}
              >
                <option value="">All types</option>
                <option value="sale">Sale</option>
                <option value="refund">Refund</option>
                <option value="exchange">Exchange</option>
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Status</label>
            <div className="relative">
              <select
                className="select"
                value={filters.status}
                onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              >
                <option value="">All statuses</option>
                <option value="completed">Completed</option>
                <option value="voided">Voided</option>
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">From</label>
            <input
              className="input"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">To</label>
            <input
              className="input"
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
            />
          </div>
          <button
            onClick={() => setApplied(filters)}
            className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
          >
            Apply
          </button>
          <button
            onClick={() => {
              const cleared = {
                transactionType: '',
                status: '',
                dateFrom: '',
                dateTo: '',
                transactionNumber: '',
              }
              setFilters(cleared)
              setApplied(cleared)
            }}
            className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
          >
            Clear
          </button>
        </div>

        {!isLoading && transactions.length > 0 && (
          <p className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{transactions.length}</span>{' '}
            transaction{transactions.length !== 1 ? 's' : ''}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex animate-pulse gap-4">
                  <div className="h-4 w-1/5 rounded bg-gray-200" />
                  <div className="h-4 w-1/6 rounded bg-gray-200" />
                  <div className="h-4 w-1/6 rounded bg-gray-200" />
                  <div className="h-4 w-1/6 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <ShoppingCart size={40} />
              <p className="text-sm">No transactions found.</p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Transaction #
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Date
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Total
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setDetail({ type: 'detail', transaction: tx })}
                  >
                    <td className="px-5 py-3 font-mono text-sm font-medium text-gray-800">
                      {tx.transactionNumber}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColor[tx.transactionType]}`}
                      >
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[tx.status]}`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      <PosDateTime iso={tx.occurredAt ?? tx.createdAt} />
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      {formatCurrency(tx.totalAmount)}
                    </td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {tx.status === 'completed' && canVoid && (
                        <button
                          onClick={() => {
                            setVoidError('')
                            setVoidTarget(tx)
                          }}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Void
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {detail.type === 'detail' && (
        <TransactionDetail
          transaction={detail.transaction}
          session={session}
          onClose={() => setDetail({ type: 'none' })}
        />
      )}

      {/* Void Confirm — only reachable if canVoid, guard is redundant but explicit */}
      {voidTarget && canVoid && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setVoidTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="mb-2 text-lg font-bold text-gray-900">Void transaction?</h2>
              <p className="mb-4 text-sm text-gray-600">
                Void <span className="font-mono">{voidTarget.transactionNumber}</span>? This cannot
                be undone.
              </p>
              {voidError && (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {voidError}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={() => setVoidTarget(null)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleVoid}
                  disabled={voidMutation.isPending}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {voidMutation.isPending ? 'Voiding…' : 'Void'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
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

function TransactionDetail({
  transaction: summary,
  session,
  onClose,
}: {
  transaction: PosTransaction
  session: SessionUser
  onClose: () => void
}) {
  const canRequestVoid = can(session, POS_PERMISSIONS.TRANSACTIONS_VOID)

  const { data: detailRes, isLoading: detailLoading } = useQuery({
    queryKey: ['pos-transaction', summary.id],
    queryFn: () => getTransaction(summary.id),
    staleTime: 60 * 1000,
  })
  const tx: PosTransaction = detailRes?.data ?? summary

  const [activeTab, setActiveTab] = useState<'details' | 'void-requests'>('details')

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

  const sendReceiptMutation = useSendReceipt()
  const [showSendReceipt, setShowSendReceipt] = useState(false)
  const [receiptForm, setReceiptForm] = useState({ email: '', phone: '' })
  const [receiptMsg, setReceiptMsg] = useState('')
  const [receiptErr, setReceiptErr] = useState('')
  const [reprinting, setReprinting] = useState(false)

  async function handleSendReceipt() {
    setReceiptErr('')
    setReceiptMsg('')
    const input = {
      email: receiptForm.email || undefined,
      phone: receiptForm.phone || undefined,
    }
    const res = await sendReceiptMutation.mutateAsync({ id: tx.id, input })
    if (!res.success) {
      setReceiptErr(res.error ?? 'Failed to send receipt')
      return
    }
    setReceiptMsg(res.data?.message ?? 'Receipt delivery queued')
    setShowSendReceipt(false)
  }

  async function handleReprint() {
    setReprinting(true)
    await getReceipt(tx.id)
    try {
      await logReprintEvent(tx.id)
    } catch {}
    setReprinting(false)

    const lineRows = (tx.lines ?? [])
      .map(
        (l) =>
          `<tr><td>${l.itemName}</td><td style="text-align:right">${l.quantity}</td><td style="text-align:right">&#8369;${l.unitPrice.toFixed(2)}</td><td style="text-align:right">&#8369;${l.lineTotal.toFixed(2)}</td></tr>`
      )
      .join('')

    const payRows = (tx.payments ?? [])
      .map(
        (p) =>
          `<tr><td style="text-transform:capitalize">${p.paymentMethod.replace(/_/g, ' ')}</td><td style="text-align:right">&#8369;${p.amount.toFixed(2)}</td></tr>`
      )
      .join('')

    const date = new Date(tx.occurredAt ?? tx.createdAt).toLocaleString('en-PH')

    const hasVatBreakdown =
      tx.vatableAmount != null || tx.vatExemptAmount != null || tx.zeroRatedAmount != null
    // BIR CAS requires all 4 VAT breakdown labels always present, even at ₱0.00
    const vatBreakdownRows = hasVatBreakdown
      ? `
  <tr><td colspan="2"><hr style="border:none;border-top:1px dashed #ccc;margin:4px 0"></td></tr>
  <tr><td style="color:#555">VATable Sales (12%)</td><td style="text-align:right;color:#555">&#8369;${(tx.vatableAmount ?? 0).toFixed(2)}</td></tr>
  <tr><td style="color:#555">VAT-Exempt Sales</td><td style="text-align:right;color:#555">&#8369;${(tx.vatExemptAmount ?? 0).toFixed(2)}</td></tr>
  <tr><td style="color:#555">Zero-Rated Sales</td><td style="text-align:right;color:#555">&#8369;${(tx.zeroRatedAmount ?? 0).toFixed(2)}</td></tr>
  <tr><td style="color:#555">VAT Amount (12%)</td><td style="text-align:right;color:#555">&#8369;${tx.taxTotal.toFixed(2)}</td></tr>`
      : tx.taxTotal > 0
        ? `<tr><td>Tax</td><td style="text-align:right">&#8369;${tx.taxTotal.toFixed(2)}</td></tr>`
        : ''

    const scPwdRow =
      tx.scPwdDiscountType && tx.scPwdIdNumber
        ? `<tr><td style="color:#2563eb">${tx.scPwdDiscountType === 'PWD' ? 'PWD' : 'SC'} Discount (${tx.scPwdName ?? ''} / ${tx.scPwdIdNumber})</td><td style="text-align:right;color:#2563eb">-&#8369;${(tx.scPwdDiscountTotal ?? 0).toFixed(2)}</td></tr>`
        : ''

    const html = `<!DOCTYPE html><html><head><title>REPRINT — ${tx.transactionNumber}</title>
<style>
  body{font-family:monospace;font-size:12px;max-width:360px;margin:0 auto;padding:16px}
  .banner{background:#000;color:#fff;text-align:center;padding:6px 0;font-size:15px;font-weight:bold;letter-spacing:6px;margin-bottom:10px}
  .center{text-align:center;margin:3px 0;color:#555}
  hr{border:none;border-top:1px dashed #aaa;margin:8px 0}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;color:#888;padding:2px 4px}
  td{padding:3px 4px}
  .total-row td{font-weight:bold;border-top:1px solid #ccc;padding-top:5px}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:10px}
  @media print{.no-print{display:none}}
</style></head><body>
<div class="banner">— REPRINT —</div>
<p class="center" style="font-weight:bold">${tx.transactionNumber}</p>
<p class="center">${date}</p>
<hr>
<table><thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr></thead><tbody>${lineRows}</tbody></table>
<hr>
<table>
  <tr><td>Subtotal</td><td style="text-align:right">&#8369;${tx.subtotal.toFixed(2)}</td></tr>
  ${tx.discountTotal > 0 ? `<tr><td>Discount</td><td style="text-align:right">-&#8369;${tx.discountTotal.toFixed(2)}</td></tr>` : ''}
  ${scPwdRow}
  ${vatBreakdownRows}
  <tr class="total-row"><td>TOTAL</td><td style="text-align:right">&#8369;${tx.totalAmount.toFixed(2)}</td></tr>
</table>
<hr>
<table><tbody>${payRows}</tbody></table>
<hr>
<p class="footer">This is a reprint of an original receipt.</p>
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

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
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
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
                        <th className="pb-1">Item</th>
                        <th className="pb-1 text-right">Qty</th>
                        <th className="pb-1 text-right">Unit Price</th>
                        <th className="pb-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tx.lines.map((l) => (
                        <tr key={l.id}>
                          <td className="py-1.5 text-gray-800">{l.itemName}</td>
                          <td className="py-1.5 text-right text-gray-600">{l.quantity}</td>
                          <td className="py-1.5 text-right text-gray-600">
                            {formatCurrency(l.unitPrice)}
                          </td>
                          <td className="py-1.5 text-right font-medium text-gray-900">
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
                <div className="border-t border-gray-200 pt-2">
                  <Row label="Total" value={formatCurrency(tx.totalAmount)} bold />
                </div>
              </div>

              {tx.payments && tx.payments.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Payments</p>
                  {tx.payments.map((p) => (
                    <div key={p.id} className="flex justify-between text-sm py-1">
                      <span className="capitalize text-gray-600">
                        {p.paymentMethod.replace('_', ' ')}
                      </span>
                      <span className="font-medium text-gray-900">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {receiptMsg && (
                <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                  {receiptMsg}
                </p>
              )}
              {receiptErr && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {receiptErr}
                </p>
              )}

              {showSendReceipt && (
                <div className="mt-4 space-y-3 rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold uppercase text-gray-500">Send Receipt</p>
                  <input
                    className="input"
                    placeholder="Email (optional)"
                    type="email"
                    value={receiptForm.email}
                    onChange={(e) => setReceiptForm((p) => ({ ...p, email: e.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="Phone (optional)"
                    value={receiptForm.phone}
                    onChange={(e) => setReceiptForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowSendReceipt(false)}
                      className="btn-secondary text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendReceipt}
                      disabled={sendReceiptMutation.isPending}
                      className="btn-primary text-xs"
                    >
                      {sendReceiptMutation.isPending ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setShowSendReceipt((v) => !v)
                    setReceiptMsg('')
                    setReceiptErr('')
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Mail size={12} />
                  Send Receipt
                </button>
                <button
                  onClick={handleReprint}
                  disabled={reprinting}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Printer size={12} />
                  {reprinting ? 'Loading…' : 'Reprint'}
                </button>
              </div>
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
