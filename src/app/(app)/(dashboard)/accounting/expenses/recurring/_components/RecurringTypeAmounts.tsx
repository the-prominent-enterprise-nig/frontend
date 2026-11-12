'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Car, IdCard, Pencil, Receipt, Search, X } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { DRIVER_ACCESS } from '@/src/libs/guards/shared-ownership'
import type { SessionUser } from '@/src/libs/guards/permission'
import { fmtDate, fmtMoney, RecurringExpenseTypes } from '@/src/libs/data/AccountingV2Data'
import { getRecurringAmounts } from '../_actions/get-recurring-amounts'
import { RECURRING_PATH } from './recurringListShared'

const PAGE_SIZE = 25

const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500'
const DATE_INPUT =
  'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const FLEET_KINDS = ['FUEL', 'VEHICLE_REPAIR']
const fmtLiters = (n: number) => n.toLocaleString('en-PH', { maximumFractionDigits: 2 })

/**
 * One entry of the Recurring Expenses list, opened by clicking it: every amount
 * recorded under it on the Expenses screen, read-only (Docket #55). This replaces
 * the separate Electricity, Vehicles and Drivers tabs — Electricity bills shows the
 * electricity payments, Fuel and Repair show theirs with the plate. Nothing here
 * files or edits an expense; each row links back to the entry it came from.
 */
export default function RecurringTypeAmounts({
  id,
  session,
}: {
  id: string
  session: SessionUser
}) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const canSeeAmounts = hasPermission(session, ACCOUNTING_PERMISSIONS.EXPENSE_READ)
  const canEditEntry = hasPermission(session, ACCOUNTING_PERMISSIONS.RECURRING_EXPENSES_UPDATE)
  const canOpenDrivers = DRIVER_ACCESS.READ.some((p) => hasPermission(session, p))
  const canOpenVehicles = canOpenDrivers || canSeeAmounts

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

  const amountsQuery = useQuery({
    queryKey: ['recurring-expense-amounts', id, params],
    queryFn: () => getRecurringAmounts(id, params),
    enabled: canSeeAmounts && !rangeInvalid,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })
  // Without expense access the amounts are not read, but the entry still has a name.
  const entryQuery = useQuery({
    queryKey: ['recurring-expense-type', id],
    queryFn: () => RecurringExpenseTypes.get(id),
    enabled: !canSeeAmounts,
    staleTime: 60 * 1000,
  })

  const payload = amountsQuery.data?.data
  const entry = payload?.entry ?? entryQuery.data?.data
  const account = entry?.account ?? null
  const rows = payload?.data ?? []
  const total = payload?.meta.total ?? 0
  const totalAmount = payload?.totals.amount ?? 0
  const lastPage = payload?.meta.lastPage ?? 1
  const hasFilters = Boolean(searchInput || from || to)
  const loadFailed = amountsQuery.data ? !amountsQuery.data.success : Boolean(amountsQuery.error)

  // A Fuel / Repair entry is read per plate, and links on to the fleet roster.
  const isFleet =
    FLEET_KINDS.includes((account as { expenseKind?: string | null } | null)?.expenseKind ?? '') ||
    rows.some((r) => r.plateNo)
  const noAccount = Boolean(entry) && !account

  return (
    <div className="px-6 py-5 lg:px-10">
      <div className="space-y-5">
        <Link
          href={RECURRING_PATH}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to recurring expenses
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1
              data-testid="recurring-entry-name"
              className="text-2xl font-semibold text-prominent-purple-900"
            >
              {entry?.name ?? 'Recurring expense'}
            </h1>
            {account && (
              <p className="mt-1 text-sm text-gray-500">
                Recorded under <span className="font-mono text-xs">{account.number}</span> —{' '}
                {account.name}. This is a read-only view; expenses are filed on the Expenses tab.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isFleet && canOpenVehicles && (
              <Link
                href="/accounting/vehicles"
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                <Car className="h-4 w-4" />
                Vehicles
              </Link>
            )}
            {isFleet && canOpenDrivers && (
              <Link
                href="/accounting/drivers"
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                <IdCard className="h-4 w-4" />
                Drivers
              </Link>
            )}
            {canEditEntry && entry && (
              <Link
                href={`${RECURRING_PATH}/${id}/edit`}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                <Pencil className="h-4 w-4" />
                Edit entry
              </Link>
            )}
          </div>
        </div>

        {!canSeeAmounts ? (
          <p className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
            You do not have access to expenses, so the amounts recorded under this entry are not
            shown.
          </p>
        ) : noAccount ? (
          <p
            data-testid="recurring-no-account"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500"
          >
            This entry has no account — its account is picked each time an expense is filed — so
            there are no amounts to show here. Give it an account with <strong>Edit entry</strong>{' '}
            to read the amounts recorded under it.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="relative min-w-64 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={
                    isFleet
                      ? 'Search by payee, plate, expense no. or description…'
                      : 'Search by payee, expense no. or description…'
                  }
                  aria-label="Search recorded amounts"
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
            {rangeInvalid && (
              <p className="text-[12px] text-red-600">From must be on or before To.</p>
            )}

            {loadFailed && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-800">
                  Failed to load the recorded amounts
                </p>
                <p className="mt-1 text-xs text-red-600">Please try refreshing the page.</p>
              </div>
            )}

            <div
              className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${amountsQuery.isFetching ? 'opacity-60' : ''}`}
            >
              {amountsQuery.isLoading ? (
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
                  data-testid="recurring-amounts-empty"
                  className="flex flex-col items-center justify-center py-16"
                >
                  <Receipt className="mb-3 h-10 w-10 text-zinc-300" />
                  <p className="text-sm font-medium text-zinc-500">
                    {hasFilters
                      ? 'No amounts match those filters'
                      : 'Nothing recorded under this entry yet'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="recurring-amounts-table">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50">
                        <th className={TH}>Date</th>
                        <th className={TH}>Expense No.</th>
                        <th className={TH}>Payee</th>
                        {isFleet && <th className={TH}>Plate No.</th>}
                        <th className={TH}>Branch</th>
                        <th className={TH}>Description</th>
                        <th className={`${TH} text-right`}>Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {rows.map((r) => {
                        // Fuel liters and the repair job read under the description.
                        const detail = [
                          r.liters != null ? `${fmtLiters(r.liters)} L` : null,
                          r.repairServiceType,
                          r.serviceDetail,
                        ]
                          .filter(Boolean)
                          .join(' — ')
                        return (
                          <tr
                            key={r.lineId}
                            data-testid="recurring-amount-row"
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
                            <td className="px-4 py-3 font-medium text-zinc-800">
                              {r.payee || '—'}
                            </td>
                            {isFleet && (
                              <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                                {r.plateNo && r.vehicleId && canOpenVehicles ? (
                                  <Link
                                    href={`/accounting/vehicles/${r.vehicleId}`}
                                    className="font-medium text-prominent-purple-800 hover:underline"
                                  >
                                    {r.plateNo}
                                  </Link>
                                ) : (
                                  (r.plateNo ?? '—')
                                )}
                              </td>
                            )}
                            <td className="px-4 py-3 text-zinc-600">{r.branch || '—'}</td>
                            <td className="px-4 py-3 text-zinc-600">
                              {r.description || '—'}
                              {detail && <p className="text-xs text-zinc-400">{detail}</p>}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-zinc-900">
                              {fmtMoney(r.amount)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {total > 0 && (
                <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-3">
                  <p className="text-xs text-zinc-500" data-testid="recurring-amounts-summary">
                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                    {total} amounts · Total {fmtMoney(totalAmount)}
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
          </>
        )}
      </div>
    </div>
  )
}
