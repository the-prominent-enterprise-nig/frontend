'use client'

import Link from 'next/link'
import { HandCoins, Search } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useEmployeeCashLoans } from '../_hooks/useEmployeeCashLoans'

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  PAID_OFF: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-50 text-red-600',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

export default function EmployeeCashLoansList({ session }: { session: SessionUser }) {
  const canIssue = hasPermission(session, POS_PERMISSIONS.EMPLOYEE_CASH_LOAN_CREATE)
  const { loans, isLoading, isFetching, error, search, setSearch } = useEmployeeCashLoans()

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-prominent-purple-900 md:text-3xl">
              Employee Cash Loans
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Amortizing cash loans issued from POS — company-wide, no approval step.
            </p>
          </div>
          {canIssue && (
            <Link
              href="/pos/employee-cash-loans/new"
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
            >
              <HandCoins className="h-4 w-4" />
              New Loan
            </Link>
          )}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by loan # or employee name…"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load employee cash loans</p>
          </div>
        )}

        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-60' : ''}`}
        >
          {isLoading ? (
            <div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-zinc-100 px-6 py-4 last:border-0"
                >
                  <div className="h-4 w-40 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-24 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : loans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <HandCoins className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No employee cash loans found</p>
              {canIssue && (
                <p className="mt-1 text-xs text-zinc-400">
                  Issue a new loan to start tracking an employee&apos;s balance.
                </p>
              )}
            </div>
          ) : (
            <div className="scroll-fade-x overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Loan #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Principal
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Term
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Monthly Deduction
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 hidden md:table-cell">
                      Next Due
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Outstanding
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan) => {
                    const nextDue = loan.scheduleLines.find(
                      (l) => new Date(l.dueDate) >= new Date()
                    )
                    return (
                      <tr
                        key={loan.id}
                        className="cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
                        onClick={() =>
                          (window.location.href = `/pos/employee-cash-loans/${loan.id}`)
                        }
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/pos/employee-cash-loans/${loan.id}`}
                            className="font-mono text-xs text-prominent-purple-700 hover:underline"
                          >
                            {loan.loanNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-medium text-zinc-900">
                          {loan.employee
                            ? `${loan.employee.firstName} ${loan.employee.lastName}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-700 hidden md:table-cell">
                          {fmt(loan.principal)}
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-500 hidden md:table-cell">
                          {loan.termMonths}mo
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-700 hidden md:table-cell">
                          {fmt(loan.monthlyDeduction)}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 hidden md:table-cell">
                          {nextDue ? new Date(nextDue.dueDate).toLocaleDateString('en-PH') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                          {fmt(loan.currentBalance)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[loan.status]}`}
                          >
                            {loan.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
