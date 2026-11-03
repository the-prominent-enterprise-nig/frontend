'use client'

import { useState } from 'react'
import Link from 'next/link'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Receipt, X } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import type { VehicleListItem } from '@/src/schema/inventory/vehicles'
import { getVehicleExpenses } from '../_actions/get-vehicle-expenses'
import { CATEGORY_LABELS, EXPENSE_KIND_LABELS } from './vehicle-labels'
import { DRIVER_ACCESS } from '@/src/libs/guards/shared-ownership'

const PAGE_SIZE = 25

const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500'
const DATE_INPUT =
  'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

const fmtLiters = (n: number) => n.toLocaleString('en-PH', { maximumFractionDigits: 2 })

// One vehicle: who/what it is, and — read-only — every Fuel and Vehicle Repair
// expense the accountant has recorded against its plate on the Expenses screen.
// Nothing here creates or edits an expense; the rows link back to the entry.
export function VehicleDetail({
  vehicle,
  session,
}: {
  vehicle: VehicleListItem
  session: SessionUser
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const canUpdate = DRIVER_ACCESS.UPDATE.some((p) => hasPermission(session, p))
  // The vehicle itself is readable with transfers:read, but its expenses are
  // accounting data and the API gates them on accounting:expense:read.
  const canSeeExpenses = hasPermission(session, ACCOUNTING_PERMISSIONS.EXPENSE_READ)

  const rangeInvalid = Boolean(from && to && from > to)
  const params = { from: from || undefined, to: to || undefined, page, limit: PAGE_SIZE }

  const expensesQuery = useQuery({
    queryKey: ['inventory-vehicles', 'expenses', vehicle.id, params],
    queryFn: () => getVehicleExpenses(vehicle.id, params),
    enabled: canSeeExpenses && !rangeInvalid,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  const payload = expensesQuery.data?.data
  const rows = payload?.data ?? []
  const total = payload?.meta.total ?? 0
  const lastPage = payload?.meta.lastPage ?? 1
  const hasPeriod = Boolean(from || to)
  const loadFailed = expensesQuery.data ? !expensesQuery.data.success : Boolean(expensesQuery.error)

  return (
    <div className="w-full min-h-full bg-zinc-50 p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
      <div className="w-full space-y-6">
        <Link
          href="/accounting/vehicles"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to vehicles
        </Link>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1
              data-testid="vehicle-plate"
              className="text-[21px] font-semibold tracking-[-0.015em] text-prominent-purple-900"
            >
              {vehicle.plateNo}
            </h1>
            <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-3">
              <Detail label="Vehicle Type" value={vehicle.tag} />
              <Detail label="Category" value={CATEGORY_LABELS[vehicle.category]} />
              <Detail label="Branch" value={vehicle.branch?.name} />
            </dl>
          </div>
          {canUpdate && (
            <Link
              href={`/accounting/vehicles/${vehicle.id}/edit`}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              <Pencil className="h-4 w-4" />
              Edit vehicle
            </Link>
          )}
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-prominent-purple-900">Expenses</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Fuel and vehicle repair expenses recorded against this plate on the Expenses screen.
              This is a read-only view.
            </p>
          </div>

          {!canSeeExpenses ? (
            <p className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-500">
              You do not have access to expenses, so this vehicle’s expenses are not shown.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
                {hasPeriod && (
                  <button
                    type="button"
                    onClick={() => {
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
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-800">Failed to load expenses</p>
                  <p className="mt-1 text-xs text-red-600">Please try refreshing the page.</p>
                </div>
              )}

              <div
                className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${expensesQuery.isFetching ? 'opacity-60' : ''}`}
              >
                {expensesQuery.isLoading ? (
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
                    data-testid="vehicle-expenses-empty"
                    className="flex flex-col items-center justify-center py-16"
                  >
                    <Receipt className="mb-3 h-10 w-10 text-zinc-300" />
                    <p className="text-sm font-medium text-zinc-500">
                      {hasPeriod
                        ? 'No expenses recorded for this vehicle in that period'
                        : 'No expenses recorded for this vehicle yet'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="vehicle-expenses-table">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50">
                          <th className={TH}>Date</th>
                          <th className={TH}>Expense No.</th>
                          <th className={TH}>Type</th>
                          <th className={TH}>Account</th>
                          <th className={TH}>Description</th>
                          <th className={`${TH} text-right`}>Liters</th>
                          <th className={TH}>Repair / Service</th>
                          <th className={`${TH} text-right`}>Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {rows.map((r) => {
                          const service = [r.repairServiceType, r.serviceDetail]
                            .filter(Boolean)
                            .join(' — ')
                          return (
                            <tr
                              key={r.lineId}
                              data-testid="vehicle-expense-row"
                              data-kind={r.kind}
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
                              <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                                {EXPENSE_KIND_LABELS[r.kind]}
                              </td>
                              <td className="px-4 py-3 text-zinc-600">{r.account}</td>
                              <td className="px-4 py-3 text-zinc-600">{r.description || '—'}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-zinc-600">
                                {r.liters != null ? fmtLiters(r.liters) : '—'}
                              </td>
                              <td className="px-4 py-3 text-zinc-600">{service || '—'}</td>
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
                    <p className="text-xs text-zinc-500">
                      Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of{' '}
                      {total} expenses
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
        </section>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-800">{value || '—'}</dd>
    </div>
  )
}
