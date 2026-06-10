'use client'

import { Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Plus,
  RefreshCw,
  FileText,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Search,
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { getPayslips } from '../_actions/payslip-actions'
import { getPayrollPeriod, getPayrollPeriods } from '../../payroll/_actions/payroll-actions'
import { getEmployees } from '../../employees/_actions/get-employee-list'
import type { Payslip } from '@/src/schema/human-resource/payslips'
import CreatePayslipModal from './CreatePayslipModal'
import EditPayslipModal from './EditPayslipModal'
import DeletePayslipModal from './DeletePayslipModal'

const PAGE_SIZE = 10

const statusColor: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

function formatDate(iso: string) {
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatCurrency(n: unknown) {
  if (typeof n !== 'number' || isNaN(n)) return '—'
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

function AdminPayslipsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const periodId = searchParams.get('periodId')

  const [search, setSearch] = useState('')
  const [selectedVisibility, setSelectedVisibility] = useState<'all' | 'visible' | 'hidden'>('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Payslip | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Payslip | null>(null)
  const [periodsPage, setPeriodsPage] = useState(1)
  const [payslipsPage, setPayslipsPage] = useState(1)

  // Period detail view (when periodId is set)
  const {
    data: periodData,
    isLoading: periodLoading,
    refetch: refetchPeriod,
  } = useQuery({
    queryKey: ['payroll-period', periodId],
    queryFn: () => getPayrollPeriod(periodId!),
    enabled: !!periodId,
    staleTime: 2 * 60 * 1000,
  })

  // Periods list view (when no periodId)
  const {
    data: periodsData,
    isLoading: periodsLoading,
    isFetching: periodsFetching,
    refetch: refetchPeriods,
  } = useQuery({
    queryKey: ['payroll-periods'],
    queryFn: () => getPayrollPeriods(),
    enabled: !periodId,
    staleTime: 2 * 60 * 1000,
  })

  const { refetch: refetchAllPayslips } = useQuery({
    queryKey: ['payslips'],
    queryFn: () => getPayslips(),
    enabled: false,
    staleTime: 2 * 60 * 1000,
  })

  const { data: employeesData } = useQuery({
    queryKey: ['employees-list-payslips'],
    queryFn: () => getEmployees({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  })

  const employees = employeesData?.data?.data ?? []
  const period = periodData?.data
  const allPeriods = periodsData?.data ?? []

  const rawPayslips: Payslip[] = (period?.payslips as Payslip[]) ?? []

  const filteredPayslips = rawPayslips.filter((p) => {
    if (search) {
      const q = search.toLowerCase()
      const name = p.employee ? `${p.employee.firstName} ${p.employee.lastName}`.toLowerCase() : ''
      if (!name.includes(q) && !p.employeeId.toLowerCase().includes(q)) return false
    }
    if (selectedVisibility === 'visible' && !p.visibility) return false
    if (selectedVisibility === 'hidden' && p.visibility) return false
    return true
  })

  const pagedPeriods = allPeriods.slice((periodsPage - 1) * PAGE_SIZE, periodsPage * PAGE_SIZE)
  const pagedPayslips = filteredPayslips.slice(
    (payslipsPage - 1) * PAGE_SIZE,
    payslipsPage * PAGE_SIZE
  )

  // ── PERIOD DETAIL / PAYSLIPS VIEW ──────────────────────────────────────────
  if (periodId) {
    return (
      <div className="min-h-full bg-zinc-50 px-6 py-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/human-resource/payslips')}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {period
                    ? `${formatDate(period.startDate)} — ${formatDate(period.endDate)}`
                    : 'Loading…'}
                </h1>
                {period && (
                  <span
                    className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[period.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {period.status}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => refetchPeriod()}
              disabled={periodLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={periodLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {/* Summary Cards */}
          {period && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Gross Pay', value: formatCurrency(period.totalAmount) },
                { label: 'Total Deductions', value: formatCurrency(period.totalDeductions) },
                { label: 'Net Pay', value: formatCurrency(period.totalNetPay) },
                { label: 'Employees', value: rawPayslips.length.toString() },
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
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPayslipsPage(1)
                }}
                placeholder="Search by employee name..."
                className="w-64 pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              {(['all', 'visible', 'hidden'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setSelectedVisibility(v)
                    setPayslipsPage(1)
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                    selectedVisibility === v
                      ? 'bg-purple-700 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-300'
                  }`}
                >
                  {v === 'all' ? 'All' : v === 'visible' ? 'Visible' : 'Hidden'}
                </button>
              ))}
            </div>
          </div>

          {/* Payslips Table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {periodLoading ? (
              <div className="p-8 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse flex gap-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/5" />
                    <div className="h-4 bg-gray-200 rounded w-1/5" />
                    <div className="h-4 bg-gray-200 rounded w-1/6" />
                  </div>
                ))}
              </div>
            ) : filteredPayslips.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                <FileText size={40} />
                <p className="text-sm">
                  {search || selectedVisibility !== 'all'
                    ? 'No payslips match the filters.'
                    : 'No payslips for this period.'}
                </p>
              </div>
            ) : (
              <>
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Employee
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                        Cycle Period
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                        Cycle #
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                        Gross Pay
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                        Deductions
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                        Net Pay
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                        Visibility
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pagedPayslips.map((payslip) => {
                      const pd = payslip.payslipData as Record<string, unknown>
                      const employeeName = payslip.employee
                        ? `${payslip.employee.firstName} ${payslip.employee.lastName}`
                        : payslip.employeeId
                      const employeeCode = payslip.employee?.employeeCode ?? ''
                      const grossDisplay = pd.totalIncome ?? pd.grossPay
                      const deductionsDisplay = pd.totalDeduction ?? pd.deductions

                      return (
                        <tr
                          key={payslip.id}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => router.push(`/human-resource/payslips/${payslip.id}`)}
                        >
                          <td className="px-5 py-3">
                            <div className="font-medium text-gray-800">{employeeName}</div>
                            {employeeCode && (
                              <div className="text-xs text-gray-400">{employeeCode}</div>
                            )}
                          </td>
                          <td className="px-5 py-3 text-gray-600">
                            {formatDate(payslip.cycleStartDate)} —{' '}
                            {formatDate(payslip.cycleEndDate)}
                          </td>
                          <td className="px-5 py-3 text-center text-gray-600">{payslip.cycle}</td>
                          <td className="px-5 py-3 text-right text-gray-700">
                            {formatCurrency(grossDisplay)}
                          </td>
                          <td className="px-5 py-3 text-right text-gray-700">
                            {formatCurrency(deductionsDisplay)}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-gray-900">
                            {formatCurrency(pd.netPay)}
                          </td>
                          <td className="px-5 py-3 text-center">
                            {payslip.visibility ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                <Eye size={10} /> Visible
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                                <EyeOff size={10} /> Hidden
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <div
                              className="flex items-center justify-end gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => setEditTarget(payslip)}
                                className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                title="Edit"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(payslip)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <Pagination
                  page={payslipsPage}
                  total={filteredPayslips.length}
                  pageSize={PAGE_SIZE}
                  onChange={setPayslipsPage}
                />
              </>
            )}
          </div>
        </div>

        {editTarget && (
          <EditPayslipModal
            payslip={editTarget}
            onClose={() => setEditTarget(null)}
            onSuccess={() => {
              setEditTarget(null)
              refetchPeriod()
            }}
          />
        )}
        {deleteTarget && (
          <DeletePayslipModal
            payslip={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onSuccess={() => {
              setDeleteTarget(null)
              refetchPeriod()
            }}
          />
        )}
      </div>
    )
  }

  // ── PERIODS LIST VIEW ─────────────────────────────────────────────────────
  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payslips</h1>
            <p className="mt-1 text-sm text-gray-500">
              Select a payroll period to view its payslips.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetchPeriods()}
              disabled={periodsFetching}
              className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={periodsFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition-colors"
            >
              <Plus size={14} />
              New Payslip
            </button>
          </div>
        </div>

        {/* Periods Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {periodsLoading ? (
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
          ) : allPeriods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <FileText size={40} />
              <p className="text-sm">No payroll periods found.</p>
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
                      Gross Pay
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Deductions
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Net Pay
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Employees
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedPeriods.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/human-resource/payslips?periodId=${p.id}`)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-purple-400" />
                          <span className="font-medium text-gray-800">
                            {formatDate(p.startDate)} — {formatDate(p.endDate)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[p.status] ?? 'bg-gray-100 text-gray-600'}`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">
                        {formatCurrency(p.totalAmount)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">
                        {formatCurrency(p.totalDeductions)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(p.totalNetPay)}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {p.payslips?.length ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={periodsPage}
                total={allPeriods.length}
                pageSize={PAGE_SIZE}
                onChange={setPeriodsPage}
              />
            </>
          )}
        </div>
      </div>

      {showCreate && (
        <CreatePayslipModal
          employees={employees}
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false)
            refetchAllPayslips()
          }}
        />
      )}
    </div>
  )
}

export default function AdminPayslipsView() {
  return (
    <Suspense>
      <AdminPayslipsContent />
    </Suspense>
  )
}
