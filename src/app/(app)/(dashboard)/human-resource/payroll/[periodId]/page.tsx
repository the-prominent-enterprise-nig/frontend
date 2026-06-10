'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Edit, Users, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { getPayrollPeriod } from '../_actions/payroll-actions'
import type { Payslip } from '@/src/schema/human-resource/payroll'

const PAGE_SIZE = 10

const statusColor: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtDate(iso: string) {
  const datePart = iso.split('T')[0]
  return new Date(datePart + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number
  total: number
  pageSize: number
  onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
      <p className="text-xs text-gray-500">
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={15} />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`min-w-7 h-7 rounded text-xs font-medium transition-colors ${
              p === page ? 'bg-purple-700 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

export default function PeriodPayrollPage({ params }: { params: Promise<{ periodId: string }> }) {
  const { periodId } = use(params)
  const router = useRouter()
  const [page, setPage] = useState(1)

  const { data, isLoading, error } = useQuery({
    queryKey: ['payroll-period', periodId],
    queryFn: () => getPayrollPeriod(periodId),
    staleTime: 2 * 60 * 1000,
  })

  const period = data?.data

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-purple-600" />
      </div>
    )
  }

  if (error || !period) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        Payroll period not found.
      </div>
    )
  }

  const payslips: Payslip[] = period.payslips ?? []
  const paged = payslips.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {fmtDate(period.startDate)} — {fmtDate(period.endDate)}
              </h1>
              <span
                className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[period.status] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {period.status}
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push(`/human-resource/payroll/${periodId}/compute`)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition-colors"
          >
            <Edit size={14} />
            Re-compute
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Amount', value: fmt(period.totalAmount) },
            { label: 'Total Deductions', value: fmt(period.totalDeductions) },
            { label: 'Net Pay', value: fmt(period.totalNetPay) },
            { label: 'Employees', value: payslips.length.toString() },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
            >
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                {card.label}
              </p>
              <p className="text-lg font-bold text-gray-900 mt-1">{card.value}</p>
            </div>
          ))}
        </div>

        {/* Notes */}
        {period.note && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Notes</p>
            <p className="text-sm text-gray-700">{period.note}</p>
          </div>
        )}

        {/* Payslips Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Users size={16} className="text-purple-500" />
            <h2 className="font-semibold text-gray-800">Payslips ({payslips.length})</h2>
          </div>
          {payslips.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">No payslips generated yet.</p>
          ) : (
            <>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Employee
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Code
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Total Amount
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Deductions
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Net Pay
                    </th>
                    <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                      Visible
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((payslip) => {
                    const d = payslip.payslipData as Record<string, number>
                    return (
                      <tr key={payslip.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-800">
                          {payslip.employee
                            ? `${payslip.employee.lastName}, ${payslip.employee.firstName}`
                            : '—'}
                        </td>
                        <td className="px-5 py-3 text-gray-500">
                          {payslip.employee?.employeeCode ?? '—'}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-700">
                          {fmt(Number(d?.total ?? 0))}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-700">
                          {fmt(Number(d?.totalDeduction ?? 0))}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900">
                          {fmt(Number(d?.netPay ?? 0))}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${payslip.visibility ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                          >
                            {payslip.visibility ? 'Yes' : 'No'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <Pagination
                page={page}
                total={payslips.length}
                pageSize={PAGE_SIZE}
                onChange={setPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
