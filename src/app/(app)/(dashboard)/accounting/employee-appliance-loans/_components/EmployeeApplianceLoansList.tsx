'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, RefreshCw, Search } from 'lucide-react'
import {
  EmployeeApplianceLoans,
  type EmployeeApplianceLoan,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  PAID_OFF: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-50 text-red-600',
}

export default function EmployeeApplianceLoansList() {
  const [items, setItems] = useState<EmployeeApplianceLoan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await EmployeeApplianceLoans.list({
      search: search || undefined,
      status: statusFilter || undefined,
    })
    setItems(res.data?.items ?? [])
    setLoading(false)
  }, [search, statusFilter])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Employee Appliance Loans</h2>
          <p className="text-sm text-gray-500">
            Financed appliance purchases for employees. Recording posts a journal entry to the GL.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <Link
            href="/accounting/employee-appliance-loans/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Loan
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search loan # / item..."
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-64"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PAID_OFF">Paid Off</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Loan #</th>
              <th className="px-3 py-2 text-left">Employee</th>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-right">Monthly Installment</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Start Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  No loans.
                </td>
              </tr>
            ) : (
              items.map((loan) => (
                <tr key={loan.id}>
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link
                      href={`/accounting/employee-appliance-loans/${loan.id}`}
                      className="text-purple-700 hover:underline"
                    >
                      {loan.loanNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {loan.employee ? `${loan.employee.firstName} ${loan.employee.lastName}` : '—'}
                  </td>
                  <td className="px-3 py-2">{loan.itemDescription}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(loan.monthlyInstallment)}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {fmtMoney(loan.currentBalance)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLES[loan.status] ?? 'bg-purple-50 text-purple-700'}`}
                    >
                      {loan.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{fmtDate(loan.startDate)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
