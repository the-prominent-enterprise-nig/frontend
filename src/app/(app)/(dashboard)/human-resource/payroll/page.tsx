'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, FileText, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { getPayrollPeriods } from './_actions/payroll-actions'
import type { PayrollPeriod } from '@/src/schema/human-resource/payroll'

const PAGE_SIZE = 10

const statusColor: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

function formatDate(iso: string) {
  const datePart = iso.split('T')[0]
  return new Date(datePart + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(n)
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
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-white">
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
            className={`min-w-[28px] h-7 rounded text-xs font-medium transition-colors ${
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

export default function PayrollPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['payroll-periods'],
    queryFn: () => getPayrollPeriods(),
    staleTime: 2 * 60 * 1000,
  })

  const periods: PayrollPeriod[] = data?.data ?? []
  const paged = periods.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage payroll periods and employee payslips.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => router.push('/human-resource/payroll/new')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors"
            >
              <Plus size={14} />
              New Payroll
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex gap-4">
                  <div className="h-4 bg-gray-200 rounded w-1/5" />
                  <div className="h-4 bg-gray-200 rounded w-1/5" />
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/6" />
                </div>
              ))}
            </div>
          ) : periods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <FileText size={40} />
              <p className="text-sm">No payroll periods yet.</p>
              <button
                onClick={() => router.push('/human-resource/payroll/new')}
                className="text-sm text-purple-600 hover:underline"
              >
                Create the first payroll period
              </button>
            </div>
          ) : (
            <>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Period
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Total Amount
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Total Deductions
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Net Pay
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Employees
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((period) => (
                    <tr
                      key={period.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/human-resource/payroll/${period.id}`)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-purple-400" />
                          <span className="font-medium text-gray-800">
                            {formatDate(period.startDate)} — {formatDate(period.endDate)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[period.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {period.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">
                        {formatCurrency(period.totalAmount)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">
                        {formatCurrency(period.totalDeductions)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(period.totalNetPay)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {period.payslips?.length ?? 0}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/human-resource/payroll/${period.id}/compute`)
                          }}
                          className="text-xs text-purple-600 hover:underline"
                        >
                          Re-compute
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={page}
                total={periods.length}
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
