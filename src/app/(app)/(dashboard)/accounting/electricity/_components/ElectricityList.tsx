'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Receipt, Search, X } from 'lucide-react'
import { fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { getElectricityPayments } from '../_actions/get-electricity-payments'

const PAGE_SIZE = 25

const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500'
const DATE_INPUT =
  'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

// Every payment recorded on Electricity / Light Expense — read-only. Nothing here
// creates or edits an expense: you pick Electricity as the account on the Expenses
// screen, with MERALCO (or whoever it is paid to) as the payee, and the payment
// shows up here. The rows link back to the entry.
export function ElectricityList() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const rangeInvalid = Boolean(from && to && from > to)
  const params = {
    search: search || undefined,
    from: from || undefined,
    to: to || undefined,
    page,
    limit: PAGE_SIZE,
  }

  const paymentsQuery = useQuery({
    queryKey: ['accounting-electricity-payments', params],
    queryFn: () => getElectricityPayments(params),
    enabled: !rangeInvalid,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  const payload = paymentsQuery.data?.data
  const rows = payload?.data ?? []
  const total = payload?.meta.total ?? 0
  const totalPaid = payload?.totals.amount ?? 0
  const lastPage = payload?.meta.lastPage ?? 1
  const hasFilters = Boolean(searchInput || from || to)
  const loadFailed = paymentsQuery.data ? !paymentsQuery.data.success : Boolean(paymentsQuery.error)

  return (
    <div className="w-full min-h-full bg-zinc-50 p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
      <div className="w-full space-y-6">
        <div>
          <h1 className="text-[21px] font-semibold tracking-[-0.015em] text-prominent-purple-900">
            Electricity
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            The payments recorded on Electricity / Light Expense. Pick Electricity as the account on
            an expense, with the provider (such as MERALCO) as the payee, and it shows here. This is
            a read-only view.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by payee, expense no. or description…"
              aria-label="Search electricity payments"
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
            />
          </div>
          <p className="text-sm font-medium text-zinc-700 sm:self-center">Period covered</p>
          <label className="block text-[13px] font-medium text-zinc-700">
            From
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value)
                setPage(1)
              }}
              aria-label="Period covered from"
              data-testid="period-from"
              className={`mt-1 block w-full sm:w-44 ${DATE_INPUT}`}
            />
          </label>
          <label className="block text-[13px] font-medium text-zinc-700">
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value)
                setPage(1)
              }}
              aria-label="Period covered to"
              data-testid="period-to"
              className={`mt-1 block w-full sm:w-44 ${DATE_INPUT}`}
            />
          </label>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                setSearch('')
                setFrom('')
                setTo('')
                setPage(1)
              }}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
        {rangeInvalid && <p className="text-[12px] text-red-600">From must be on or before To.</p>}

        {loadFailed && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load electricity payments</p>
            <p className="mt-1 text-xs text-red-600">Please try refreshing the page.</p>
          </div>
        )}

        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${paymentsQuery.isFetching ? 'opacity-60' : ''}`}
        >
          {paymentsQuery.isLoading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-zinc-100 px-6 py-4 last:border-0"
                >
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-20 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div
              data-testid="electricity-empty"
              className="flex flex-col items-center justify-center py-16"
            >
              <Receipt className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">
                {hasFilters
                  ? 'No electricity payments match those filters'
                  : 'No electricity payments recorded yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="electricity-table">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className={TH}>Date</th>
                    <th className={TH}>Expense No.</th>
                    <th className={TH}>Payee</th>
                    <th className={TH}>Branch</th>
                    <th className={TH}>Description</th>
                    <th className={`${TH} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((r) => (
                    <tr
                      key={r.lineId}
                      data-testid="electricity-row"
                      className="align-top hover:bg-zinc-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                        {fmtDate(r.expenseDate)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/accounting/expenses/${r.expenseId}`}
                          className="font-medium text-prominent-purple-800 hover:underline"
                        >
                          {r.expenseNumber}
                        </Link>
                        {r.voucherNumber && (
                          <p className="text-xs text-zinc-400">{r.voucherNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-800">{r.payee || '—'}</td>
                      <td className="px-4 py-3 text-zinc-600">{r.branch || '—'}</td>
                      <td className="px-4 py-3 text-zinc-600">{r.description || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-zinc-900">
                        {fmtMoney(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > 0 && (
            <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs text-zinc-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}{' '}
                payments · Total {fmtMoney(totalPaid)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-zinc-500">
                  {page} / {lastPage}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  disabled={page >= lastPage}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
