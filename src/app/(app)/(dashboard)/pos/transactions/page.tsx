'use client'

import { useState } from 'react'
import {
  useTransactions,
  useVoidTransaction,
  useSendReceipt,
  useSubmitVoidRequest,
  usePendingVoidRequests,
  useApproveVoidRequest,
  useRejectVoidRequest,
} from '../_hooks/usePos'
import {
  RefreshCw,
  ShoppingCart,
  X,
  Search,
  ChevronDown,
  Mail,
  Printer,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ClipboardList,
} from 'lucide-react'
import { getReceipt, logReprintEvent } from '../_actions/pos-actions'
import type { PosTransaction, PosVoidRequest } from '@/src/schema/pos'
import { PosDateTime } from '../_components/PosDate'

const typeColor: Record<string, string> = {
  sale: 'bg-blue-100 text-blue-700',
  refund: 'bg-orange-100 text-orange-700',
  exchange: 'bg-purple-100 text-purple-700',
}

const statusColor: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  voided: 'bg-red-100 text-red-700',
}

const requestStatusColor: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

function isSameDay(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

type ActiveTab = 'transactions' | 'pending-requests'
type DetailModal = { type: 'none' } | { type: 'detail'; transaction: PosTransaction }

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('transactions')
  const [filters, setFilters] = useState({
    transactionType: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    transactionNumber: '',
  })
  const [applied, setApplied] = useState(filters)
  const [detail, setDetail] = useState<DetailModal>({ type: 'none' })

  // Old-style void (non-same-day)
  const [voidTarget, setVoidTarget] = useState<PosTransaction | null>(null)
  const [voidError, setVoidError] = useState('')

  // Void request (same-day)
  const [voidRequestTarget, setVoidRequestTarget] = useState<PosTransaction | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidRequestError, setVoidRequestError] = useState('')
  const [voidRequestSuccess, setVoidRequestSuccess] = useState(false)

  // Manager review
  const [reviewTarget, setReviewTarget] = useState<PosVoidRequest | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null)
  const [reviewError, setReviewError] = useState('')

  const { data, isLoading, isFetching, refetch } = useTransactions(
    Object.fromEntries(Object.entries(applied).filter(([, v]) => v !== '')) as Record<
      string,
      string
    >
  )
  const {
    data: pendingData,
    isLoading: pendingLoading,
    refetch: refetchPending,
  } = usePendingVoidRequests()

  const voidMutation = useVoidTransaction()
  const submitVoidMutation = useSubmitVoidRequest()
  const approveMutation = useApproveVoidRequest()
  const rejectMutation = useRejectVoidRequest()

  const transactions: PosTransaction[] = data?.data ?? []
  const pendingRequests: PosVoidRequest[] = pendingData?.data ?? []

  async function handleDirectVoid() {
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

  async function handleSubmitVoidRequest() {
    if (!voidRequestTarget || !voidReason.trim()) return
    setVoidRequestError('')
    try {
      const res = await submitVoidMutation.mutateAsync({
        transactionId: voidRequestTarget.id,
        input: { reason: voidReason.trim() },
      })
      if (!res.success) {
        setVoidRequestError(res.error ?? 'Failed to submit void request')
        return
      }
      setVoidRequestSuccess(true)
    } catch (err) {
      setVoidRequestError(err instanceof Error ? err.message : 'Failed to submit void request')
    }
  }

  function closeVoidRequestModal() {
    setVoidRequestTarget(null)
    setVoidReason('')
    setVoidRequestError('')
    setVoidRequestSuccess(false)
  }

  async function handleReview(action: 'approve' | 'reject') {
    if (!reviewTarget) return
    setReviewError('')
    try {
      const input = { reviewNotes: reviewNotes.trim() || undefined }
      const res =
        action === 'approve'
          ? await approveMutation.mutateAsync({ requestId: reviewTarget.id, input })
          : await rejectMutation.mutateAsync({ requestId: reviewTarget.id, input })
      if (!res.success) {
        setReviewError(res.error ?? `Failed to ${action} request`)
        return
      }
      setReviewTarget(null)
      setReviewNotes('')
      setReviewAction(null)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : `Failed to ${action} request`)
    }
  }

  const isReviewPending = approveMutation.isPending || rejectMutation.isPending

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
            <p className="mt-1 text-sm text-gray-500">All sales, refunds, and exchanges.</p>
          </div>
          <button
            onClick={() => (activeTab === 'transactions' ? refetch() : refetchPending())}
            disabled={isFetching || pendingLoading}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching || pendingLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm w-fit">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'transactions'
                ? 'bg-purple-700 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ShoppingCart size={14} />
            All Transactions
          </button>
          <button
            onClick={() => setActiveTab('pending-requests')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'pending-requests'
                ? 'bg-purple-700 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ClipboardList size={14} />
            Void Requests
            {pendingRequests.length > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Tab: All Transactions ── */}
        {activeTab === 'transactions' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex-1 min-w-40">
                <label className="mb-1 block text-xs font-semibold text-gray-600">
                  Transaction #
                </label>
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    className="input pl-8"
                    placeholder="Search…"
                    value={filters.transactionNumber}
                    onChange={(e) =>
                      setFilters((p) => ({ ...p, transactionNumber: e.target.value }))
                    }
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

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
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
                    {transactions.map((tx) => {
                      const sameDayTx = isSameDay(tx.occurredAt ?? tx.createdAt)
                      return (
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
                            {tx.status === 'completed' &&
                              (sameDayTx ? (
                                <button
                                  onClick={() => {
                                    setVoidReason('')
                                    setVoidRequestError('')
                                    setVoidRequestSuccess(false)
                                    setVoidRequestTarget(tx)
                                  }}
                                  className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:underline"
                                >
                                  <Clock size={11} />
                                  Request Void
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setVoidError('')
                                    setVoidTarget(tx)
                                  }}
                                  className="text-xs font-medium text-red-600 hover:underline"
                                >
                                  Void
                                </button>
                              ))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── Tab: Pending Void Requests ── */}
        {activeTab === 'pending-requests' && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {pendingLoading ? (
              <div className="space-y-3 p-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex animate-pulse gap-4">
                    <div className="h-4 w-1/4 rounded bg-gray-200" />
                    <div className="h-4 w-1/3 rounded bg-gray-200" />
                    <div className="h-4 w-1/5 rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
                <CheckCircle2 size={40} />
                <p className="text-sm">No pending void requests.</p>
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Transaction #
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Amount
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Reason
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Submitted
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Status
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-mono text-sm font-medium text-gray-800">
                        {req.transaction?.transactionNumber ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-700">
                        {req.transaction ? formatCurrency(req.transaction.totalAmount) : '—'}
                      </td>
                      <td className="max-w-xs px-5 py-3 text-gray-600 truncate">{req.reason}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        <PosDateTime iso={req.createdAt} />
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${requestStatusColor[req.status]}`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => {
                            setReviewTarget(req)
                            setReviewNotes('')
                            setReviewAction(null)
                            setReviewError('')
                          }}
                          className="text-xs font-medium text-purple-600 hover:underline"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {detail.type === 'detail' && (
        <TransactionDetail
          transaction={detail.transaction}
          onClose={() => setDetail({ type: 'none' })}
        />
      )}

      {/* ── Direct Void Confirm (non-same-day) ── */}
      {voidTarget && (
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
                  onClick={handleDirectVoid}
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

      {/* ── Void Request Modal (same-day) ── */}
      {voidRequestTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closeVoidRequestModal} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <button
                onClick={closeVoidRequestModal}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>

              {voidRequestSuccess ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <CheckCircle2 size={40} className="text-green-500" />
                  <h2 className="text-lg font-bold text-gray-900">Request submitted</h2>
                  <p className="text-sm text-gray-500">
                    A branch manager will review and approve before the transaction is voided.
                  </p>
                  <button onClick={closeVoidRequestModal} className="btn-primary mt-2">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-start gap-3">
                    <span className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-600">
                      <AlertTriangle size={16} />
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-gray-900">Request void</h2>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Same-day transactions require manager approval.{' '}
                        <span className="font-mono font-medium text-gray-700">
                          {voidRequestTarget.transactionNumber}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="input min-h-[80px] resize-none"
                      placeholder="Describe why this transaction needs to be voided…"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      maxLength={500}
                    />
                    <p className="mt-1 text-right text-xs text-gray-400">{voidReason.length}/500</p>
                  </div>

                  {voidRequestError && (
                    <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                      {voidRequestError}
                    </p>
                  )}

                  <div className="flex justify-end gap-3">
                    <button onClick={closeVoidRequestModal} className="btn-secondary">
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitVoidRequest}
                      disabled={!voidReason.trim() || submitVoidMutation.isPending}
                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      {submitVoidMutation.isPending ? 'Submitting…' : 'Submit request'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Manager Review Modal ── */}
      {reviewTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => {
              setReviewTarget(null)
              setReviewAction(null)
            }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <button
                onClick={() => {
                  setReviewTarget(null)
                  setReviewAction(null)
                }}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>

              <h2 className="mb-1 text-lg font-bold text-gray-900">Review void request</h2>
              <p className="mb-4 text-xs text-gray-500">
                Transaction{' '}
                <span className="font-mono font-medium text-gray-700">
                  {reviewTarget.transaction?.transactionNumber ?? reviewTarget.transactionId}
                </span>
                {reviewTarget.transaction && (
                  <> · {formatCurrency(reviewTarget.transaction.totalAmount)}</>
                )}
              </p>

              <div className="mb-4 rounded-xl bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase text-gray-400">Reason provided</p>
                <p className="mt-1 text-sm text-gray-700">{reviewTarget.reason}</p>
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  Review notes (optional)
                </label>
                <textarea
                  className="input min-h-[64px] resize-none"
                  placeholder="Add any notes for the record…"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>

              {reviewError && (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {reviewError}
                </p>
              )}

              {reviewAction ? (
                <div className="rounded-xl border border-gray-200 p-3 mb-4">
                  <p className="text-sm text-gray-700">
                    {reviewAction === 'approve'
                      ? 'This will immediately void the transaction and restock inventory.'
                      : 'The transaction will remain unchanged.'}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-gray-500">Are you sure?</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setReviewAction(null)} className="btn-secondary text-xs">
                      Back
                    </button>
                    <button
                      onClick={() => handleReview(reviewAction)}
                      disabled={isReviewPending}
                      className={`rounded-lg px-4 py-2 text-xs font-medium text-white disabled:opacity-50 ${
                        reviewAction === 'approve'
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {isReviewPending
                        ? reviewAction === 'approve'
                          ? 'Approving…'
                          : 'Rejecting…'
                        : reviewAction === 'approve'
                          ? 'Yes, approve & void'
                          : 'Yes, reject'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() => setReviewAction('reject')}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                  <button
                    onClick={() => setReviewAction('approve')}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    <CheckCircle2 size={14} />
                    Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function TransactionDetail({
  transaction: tx,
  onClose,
}: {
  transaction: PosTransaction
  onClose: () => void
}) {
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
  ${tx.taxTotal > 0 ? `<tr><td>Tax</td><td style="text-align:right">&#8369;${tx.taxTotal.toFixed(2)}</td></tr>` : ''}
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

          {tx.lines && tx.lines.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Items</p>
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
            </div>
          )}

          <div className="rounded-xl bg-gray-50 p-4 text-sm space-y-1">
            <Row label="Subtotal" value={formatCurrency(tx.subtotal)} />
            {tx.discountTotal > 0 && (
              <Row label="Discount" value={`-${formatCurrency(tx.discountTotal)}`} />
            )}
            {tx.taxTotal > 0 && <Row label="Tax" value={formatCurrency(tx.taxTotal)} />}
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
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{receiptErr}</p>
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
                <button onClick={() => setShowSendReceipt(false)} className="btn-secondary text-xs">
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
        </div>
      </div>
    </>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
