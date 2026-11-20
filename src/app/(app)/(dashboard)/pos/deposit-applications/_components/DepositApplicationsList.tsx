'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CustomerDeposits,
  fmtDate,
  fmtMoney,
  type DepositApplicationRow,
  type DepositApplicationStatus,
} from '@/src/libs/data/AccountingV2Data'
import SegmentedControl from '@/src/components/ui/SegmentedControl'
import { DepositStatusChip, humanizeDepositError } from '@/src/components/crm/CustomerDepositsCard'

type Filter = DepositApplicationStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Applied' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

/**
 * Approvals & Reviews › Deposit Applications (Docket NIG #91).
 *
 * Each row is one request to apply a customer's deposit to one aging account.
 * While it waits, its amount is reserved and nothing is posted. Approve posts
 * Dr Customer Deposits / Cr Accounts Receivable and lowers the account; Reject
 * needs a reason and gives the deposit back. Both are the Approver's. Head
 * Office AR can cancel a request that is still waiting.
 */
export default function DepositApplicationsList({
  canApply,
  canApprove,
}: {
  canApply: boolean
  canApprove: boolean
}) {
  const [filter, setFilter] = useState<Filter>('PENDING')
  // One list per tab, each written only by its own fetch, so a slow answer for
  // one tab (or the refresh after a decision) can never replace another tab's.
  const [results, setResults] = useState<Partial<Record<Filter, DepositApplicationRow[]>>>({})
  const rows = results[filter] ?? null
  const [loadError, setLoadError] = useState<string | null>(null)
  // One row at a time is mid-decision: approving (asks to confirm) or rejecting
  // (asks for the reason).
  const [deciding, setDeciding] = useState<{ id: string; mode: 'approve' | 'reject' } | null>(null)
  const [reason, setReason] = useState('')
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await CustomerDeposits.list({ status: filter })
    if (res.success && res.data) {
      setResults((r) => ({ ...r, [filter]: res.data!.applications }))
      setLoadError(null)
    } else {
      setLoadError(res.error ?? 'Failed to load deposit applications')
    }
  }, [filter])

  useEffect(() => {
    let cancelled = false
    CustomerDeposits.list({ status: filter }).then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        setResults((r) => ({ ...r, [filter]: res.data!.applications }))
        setLoadError(null)
      } else {
        setLoadError(res.error ?? 'Failed to load deposit applications')
      }
    })
    return () => {
      cancelled = true
    }
  }, [filter])

  function startDeciding(id: string, mode: 'approve' | 'reject') {
    setDeciding({ id, mode })
    setReason('')
    setRowError(null)
  }

  async function run(id: string, action: () => Promise<{ success?: boolean; error?: string }>) {
    setBusyId(id)
    setRowError(null)
    const res = await action()
    setBusyId(null)
    if (!res.success) {
      setRowError({ id, message: humanizeDepositError(res.error) })
      return
    }
    setDeciding(null)
    load()
  }

  function confirmReject(app: DepositApplicationRow) {
    if (!reason.trim()) {
      setRowError({ id: app.id, message: 'Say why it is rejected.' })
      return
    }
    run(app.id, () => CustomerDeposits.reject(app.id, reason.trim()))
  }

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold text-prominent-purple-900">Deposit Applications</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Requests to apply a customer&apos;s deposit to one of their aging accounts. A request
          reserves the deposit and changes nothing until it is approved.
        </p>
      </div>

      <div>
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          options={FILTERS}
          name="Show requests"
          size="sm"
        />
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {loadError}
        </div>
      )}

      {rows === null && !loadError ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
      ) : rows && rows.length === 0 ? (
        <p
          data-testid="deposit-applications-empty"
          className="rounded-xl border border-gray-100 bg-white py-10 text-center text-sm text-gray-400"
        >
          {filter === 'PENDING' ? 'Nothing is waiting for approval.' : 'No requests here.'}
        </p>
      ) : (
        rows && (
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="deposit-applications-table">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {[
                      'Requested',
                      'Customer',
                      'Aging account',
                      'Deposit',
                      'Amount',
                      'Status',
                      '',
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
                <tbody>
                  {rows.map((a) => {
                    const mine = deciding?.id === a.id
                    return (
                      <tr
                        key={a.id}
                        data-testid="deposit-application-row"
                        className="border-b border-gray-100 align-top last:border-0"
                      >
                        <td className="px-5 py-3 text-gray-700">
                          <p>{fmtDate(a.requestedAt)}</p>
                          {a.requestedBy && (
                            <p className="text-xs text-gray-500">by {a.requestedBy}</p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            href={`/crm/customers/${a.customerId}`}
                            className="font-medium text-prominent-purple-700 hover:underline"
                          >
                            {a.customerName ?? 'Customer'}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-gray-700">
                          <p className="font-mono text-xs font-medium">{a.siNo ?? '—'}</p>
                          <p className="text-xs text-gray-500">{a.branchName ?? 'No branch'}</p>
                          {a.status === 'PENDING' && a.accountOutstanding != null && (
                            <p className="mt-0.5 text-xs text-gray-500">
                              Owes {fmtMoney(a.accountOutstanding)} now
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-gray-700">
                          <p className="font-mono text-xs">
                            {a.depositReferences.length ? a.depositReferences.join(', ') : '—'}
                          </p>
                          {a.status === 'PENDING' && a.customerAvailableDeposit != null && (
                            <p className="mt-0.5 text-xs text-gray-500">
                              {fmtMoney(a.customerAvailableDeposit)} still available
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-gray-900">{fmtMoney(a.amount)}</p>
                          {a.remarks && (
                            <p className="mt-0.5 max-w-[16rem] text-xs text-gray-500">
                              {a.remarks}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <DepositStatusChip status={a.status} />
                          {a.status === 'APPROVED' && a.postingDate && (
                            <p className="mt-1 text-xs text-gray-500">
                              {fmtDate(a.postingDate)}
                              {a.resolvedBy ? ` · ${a.resolvedBy}` : ''}
                            </p>
                          )}
                          {a.status === 'REJECTED' && (
                            <p className="mt-1 max-w-[14rem] text-xs text-gray-500">
                              {a.resolvedBy ? `${a.resolvedBy}: ` : ''}
                              {a.rejectionReason}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {a.status === 'PENDING' && !mine && (
                            <div className="flex flex-wrap justify-end gap-2">
                              {canApprove && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startDeciding(a.id, 'approve')}
                                    className="rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-prominent-purple-800"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startDeciding(a.id, 'reject')}
                                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {canApply && (
                                <button
                                  type="button"
                                  disabled={busyId === a.id}
                                  onClick={() => run(a.id, () => CustomerDeposits.cancel(a.id))}
                                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                                >
                                  Cancel request
                                </button>
                              )}
                            </div>
                          )}
                          {a.status === 'PENDING' && mine && deciding?.mode === 'approve' && (
                            <div className="space-y-2 text-right">
                              <p className="text-xs text-gray-600">
                                Post {fmtMoney(a.amount)} from Customer Deposits to Accounts
                                Receivable?
                              </p>
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={busyId === a.id}
                                  onClick={() => run(a.id, () => CustomerDeposits.approve(a.id))}
                                  className="rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-prominent-purple-800 disabled:opacity-60"
                                >
                                  {busyId === a.id ? 'Posting…' : 'Yes, approve'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeciding(null)}
                                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                >
                                  Back
                                </button>
                              </div>
                            </div>
                          )}
                          {a.status === 'PENDING' && mine && deciding?.mode === 'reject' && (
                            <div className="space-y-2">
                              <input
                                value={reason}
                                maxLength={500}
                                onChange={(e) => {
                                  setReason(e.target.value)
                                  setRowError(null)
                                }}
                                placeholder="Reason for rejecting"
                                aria-label="Reason for rejecting"
                                className="w-full min-w-[14rem] rounded-lg border border-gray-200 px-3 py-1.5 text-xs"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={busyId === a.id}
                                  onClick={() => confirmReject(a)}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                                >
                                  {busyId === a.id ? 'Rejecting…' : 'Reject'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeciding(null)}
                                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                >
                                  Back
                                </button>
                              </div>
                            </div>
                          )}
                          {rowError?.id === a.id && (
                            <p className="mt-1 text-right text-xs text-red-600">
                              {rowError.message}
                            </p>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
