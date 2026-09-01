'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTransactions } from '../../_hooks/usePos'
import {
  RefreshCw,
  ShoppingCart,
  Search,
  ChevronDown,
  KeyRound,
  ShieldCheck,
  Loader2,
} from 'lucide-react'
import {
  validateManagerOverride,
  submitVoidRequest,
  approveReturnRefundRequest,
  getTransaction,
} from '../../_actions/pos-actions'
import type { PosTransaction } from '@/src/schema/pos'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { PosDateTime } from '../../_components/PosDate'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { type SessionUser, can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { TransactionDetail } from '../../_components/TransactionDetail'

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
  const canVoid = can(session, POS_PERMISSIONS.TRANSACTIONS_READ)
  const canDirectVoid = can(session, POS_PERMISSIONS.TRANSACTIONS_OVERRIDE)
  const canRefund = can(session, POS_PERMISSIONS.TRANSACTIONS_CREATE)
  const { branchId } = usePosBranchContext()

  const [filters, setFilters] = useState({
    transactionType: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  })
  const [applied, setApplied] = useState(filters)
  // Scenario 23 Gap 3 — kept separate from filters/applied above: the
  // Type/Status/Date filters still wait for an explicit Apply click (you're
  // usually setting several before submitting), but a plain search box
  // should just search as you stop typing, no button needed.
  const searchParams = useSearchParams()
  // Lets an AR Invoice "Sale: <transactionNumber>" link deep-link straight
  // into a prefilled search, rather than landing on an empty list.
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') ?? '')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])
  const [detail, setDetail] = useState<DetailModal>({ type: 'none' })
  // Deep-link from the POS Overview page's Recent Transactions list
  // (?id=<transactionId>) — opens the detail modal directly instead of
  // landing on the plain list. Fetched by id rather than matched against
  // the loaded/filtered page of `transactions`, so it opens even if the
  // target row wouldn't otherwise be on the first page of results.
  useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return
    let cancelled = false
    getTransaction(id).then((res) => {
      if (!cancelled && res.success && res.data) {
        setDetail({ type: 'detail', transaction: res.data })
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [voidTarget, setVoidTarget] = useState<PosTransaction | null>(null)
  const [voidError, setVoidError] = useState('')
  const [voidReason, setVoidReason] = useState('')
  const [voidMode, setVoidMode] = useState<'id-and-pin' | 'request'>('id-and-pin')
  const [voidManagerId, setVoidManagerId] = useState('')
  const [voidManagerPin, setVoidManagerPin] = useState('')
  const [voidPending, setVoidPending] = useState(false)

  useEffect(() => {
    if (!voidTarget) setVoidError('')
  }, [voidTarget])

  useEffect(() => {
    if (!voidTarget) setVoidError('')
  }, [voidTarget])

  const { data, isLoading, isFetching, refetch } = useTransactions(
    Object.fromEntries(
      Object.entries({
        ...applied,
        transactionNumber: debouncedSearch,
        branchId: branchId ?? '',
      }).filter(([, v]) => v !== '')
    ) as Record<string, string>
  )

  const transactions: PosTransaction[] = data?.data ?? []

  async function handleVoid() {
    if (!voidTarget) return
    if (!voidReason.trim()) {
      setVoidError('A reason for the void is required.')
      return
    }
    setVoidError('')
    setVoidPending(true)

    if (voidMode === 'request') {
      const reqRes = await submitVoidRequest(voidTarget.id, { reason: voidReason.trim() })
      setVoidPending(false)
      if (!reqRes.success) {
        setVoidError(reqRes.error ?? 'Failed to submit void request.')
        return
      }
      setVoidTarget(null)
      setVoidReason('')
      return
    }

    // ID + PIN: manager or owner present
    if (!voidManagerId.trim()) {
      setVoidError('Manager ID is required.')
      setVoidPending(false)
      return
    }
    if (!voidManagerPin.trim()) {
      setVoidError('PIN is required.')
      setVoidPending(false)
      return
    }

    const pinRes = await validateManagerOverride(voidManagerId.trim(), voidManagerPin.trim())
    if (!pinRes.success || !pinRes.data?.valid) {
      setVoidError(pinRes.error ?? 'Invalid ID or PIN. Please try again.')
      setVoidPending(false)
      return
    }
    const managerName = pinRes.data.managerName

    const reqRes = await submitVoidRequest(voidTarget.id, { reason: voidReason.trim() })
    if (!reqRes.success || !reqRes.data) {
      setVoidError(reqRes.error ?? 'Failed to submit void request.')
      setVoidPending(false)
      return
    }

    const approveRes = await approveReturnRefundRequest(reqRes.data.id, {
      reviewNotes: `Authorized by ${managerName}`,
    })
    setVoidPending(false)
    if (!approveRes.success) {
      setVoidError(approveRes.error ?? 'Failed to void.')
      return
    }
    setVoidTarget(null)
    setVoidReason('')
    setVoidManagerId('')
    setVoidManagerPin('')
    refetch()
  }

  function openVoidModal(tx: PosTransaction) {
    setVoidTarget(tx)
    setVoidError('')
    setVoidReason('')
    setVoidMode('id-and-pin')
    setVoidManagerId('')
    setVoidManagerPin('')
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
            {/* Scenario 23 Gap 3 — unified search: matches the transaction
                number OR any invoice number it produced, so staff starting
                from either a receipt's transaction # or a bank memo's
                invoice # can find the same transaction here. */}
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Transaction # or Invoice #
            </label>
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                className="input"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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
              const cleared = { transactionType: '', status: '', dateFrom: '', dateTo: '' }
              setFilters(cleared)
              setApplied(cleared)
              setSearch('')
              setDebouncedSearch('')
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

        <div
          className={`overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${
            isFetching && !isLoading ? 'opacity-60' : ''
          }`}
        >
          {isLoading ? (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    <td className="px-5 py-3 text-right text-gray-600">
                      {formatCurrency(tx.totalAmount)}
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
          canVoid={canVoid}
          canRefund={canRefund}
          onVoid={() => {
            setDetail({ type: 'none' })
            openVoidModal(detail.transaction)
          }}
          onRefunded={() => refetch()}
        />
      )}

      {/* Void Modal */}
      {voidTarget && canVoid && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => !voidPending && setVoidTarget(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              {/* Header */}
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <KeyRound size={18} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Void Transaction</h2>
                  <p className="font-mono text-xs text-gray-500">{voidTarget.transactionNumber}</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* Reason */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <input
                    autoFocus
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                    placeholder="e.g. Incorrect item scanned"
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    disabled={voidPending}
                  />
                </div>

                {/* Mode tabs — always shown so cashiers can offer manager override */}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setVoidMode('request')
                      setVoidManagerId('')
                      setVoidManagerPin('')
                    }}
                    className={`flex-1 py-2 transition-colors ${voidMode === 'request' ? 'bg-gray-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    Request Approval
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVoidMode('id-and-pin')
                      setVoidManagerId('')
                      setVoidManagerPin('')
                    }}
                    className={`flex-1 py-2 transition-colors ${voidMode === 'id-and-pin' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    Manager Override
                  </button>
                </div>

                {voidMode === 'id-and-pin' ? (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={13} className="text-amber-600" />
                      <p className="text-xs font-semibold text-amber-700">
                        Manager / Owner Authorization
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Employee ID
                      </label>
                      <input
                        autoFocus
                        type="text"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        placeholder="Manager or owner employee ID"
                        value={voidManagerId}
                        onChange={(e) => setVoidManagerId(e.target.value)}
                        disabled={voidPending}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono tracking-widest text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        placeholder="••••"
                        value={voidManagerPin}
                        onChange={(e) =>
                          setVoidManagerPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        onKeyDown={(e) => e.key === 'Enter' && handleVoid()}
                        disabled={voidPending}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">
                      A void request will be sent for manager approval. The transaction will be
                      voided once approved from the{' '}
                      <span className="font-medium text-gray-700">Void Requests</span> page.
                    </p>
                  </div>
                )}
              </div>

              {voidError && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {voidError}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setVoidTarget(null)}
                  disabled={voidPending}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVoid}
                  disabled={
                    voidPending ||
                    !voidReason.trim() ||
                    (voidMode === 'id-and-pin' && (!voidManagerId.trim() || !voidManagerPin.trim()))
                  }
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {voidPending ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />{' '}
                      {voidMode === 'request' ? 'Submitting…' : 'Voiding…'}
                    </>
                  ) : voidMode === 'request' ? (
                    'Submit Request'
                  ) : (
                    'Void Transaction'
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
