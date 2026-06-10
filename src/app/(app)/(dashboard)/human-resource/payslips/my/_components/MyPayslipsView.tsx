'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  FileText,
  RefreshCw,
  Printer,
  Download,
  ChevronRight,
  Eye,
  EyeOff,
  TrendingUp,
  Minus,
  Wallet,
  AlertCircle,
  Lock,
} from 'lucide-react'
import { getMyPayslips } from '../../_actions/payslip-actions'
import type { Payslip } from '@/src/schema/human-resource/payslips'

interface Props {
  employeeName: string
}

function fmt(n: unknown) {
  if (typeof n !== 'number' || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(n)
}

function fmtDate(iso: string) {
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getYear(iso: string) {
  return new Date(iso.slice(0, 10) + 'T00:00:00').getFullYear()
}

function PayslipCard({
  payslip,
  onClick,
  onPrint,
  onDownload,
}: {
  payslip: Payslip
  onClick: () => void
  onPrint: (e: React.MouseEvent) => void
  onDownload: (e: React.MouseEvent) => void
}) {
  const pd = payslip.payslipData as Record<string, unknown>
  const isGenerated = 'totalIncome' in pd || 'incomeTaxDeduction' in pd

  const grossDisplay = isGenerated ? pd.totalIncome : pd.grossPay
  const deductionsDisplay = isGenerated ? pd.totalDeduction : pd.deductions
  const netPay = pd.netPay

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer overflow-hidden"
    >
      {/* Card top stripe */}
      <div className="h-1.5 bg-gradient-to-r from-purple-600 to-purple-400" />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Cycle #{payslip.cycle}
            </p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">
              {fmtDate(payslip.cycleStartDate)} — {fmtDate(payslip.cycleEndDate)}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {payslip.visibility ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <Eye size={9} /> Visible
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
                <EyeOff size={9} /> Hidden
              </span>
            )}
          </div>
        </div>

        {/* Financial summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <TrendingUp size={14} className="mx-auto text-blue-400 mb-1" />
            <p className="text-xs text-gray-400 mb-0.5">Gross Pay</p>
            <p className="text-xs font-semibold text-gray-700 tabular-nums">{fmt(grossDisplay)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <Minus size={14} className="mx-auto text-red-400 mb-1" />
            <p className="text-xs text-gray-400 mb-0.5">Deductions</p>
            <p className="text-xs font-semibold text-gray-700 tabular-nums">
              {fmt(deductionsDisplay)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <Wallet size={14} className="mx-auto text-purple-500 mb-1" />
            <p className="text-xs text-gray-400 mb-0.5">Net Pay</p>
            <p className="text-sm font-bold text-purple-700 tabular-nums">{fmt(netPay)}</p>
          </div>
        </div>

        {/* Government deductions row (generated only) */}
        {isGenerated && (
          <div className="flex gap-3 mb-4 text-xs text-gray-500">
            {Number(pd.sss) > 0 && (
              <span className="bg-gray-50 px-2 py-1 rounded">SSS {fmt(pd.sss)}</span>
            )}
            {Number(pd.philHealth) > 0 && (
              <span className="bg-gray-50 px-2 py-1 rounded">PhilHealth {fmt(pd.philHealth)}</span>
            )}
            {Number(pd.pagIbig) > 0 && (
              <span className="bg-gray-50 px-2 py-1 rounded">Pag-IBIG {fmt(pd.pagIbig)}</span>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <button
              onClick={onPrint}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-600 transition-colors"
            >
              <Printer size={13} />
              Print
            </button>
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-600 transition-colors"
            >
              <Download size={13} />
              Download
            </button>
          </div>
          <span className="flex items-center gap-1 text-xs text-purple-600 group-hover:gap-2 transition-all">
            View Details <ChevronRight size={13} />
          </span>
        </div>
      </div>
    </div>
  )
}

async function fetchPdfBlob(payslipId: string): Promise<Blob> {
  const res = await fetch(`/api/payslips/${payslipId}/download`)
  if (!res.ok) throw new Error('Download failed')
  return res.blob()
}

async function downloadPayslip(payslipId: string) {
  try {
    const blob = await fetchPdfBlob(payslipId)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payslip-${payslipId}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    alert('Failed to download payslip. Please try again.')
  }
}

async function printPayslip(payslipId: string) {
  try {
    const blob = await fetchPdfBlob(payslipId)
    const url = URL.createObjectURL(blob)
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden;'
    iframe.src = url
    document.body.appendChild(iframe)
    iframe.onload = () => {
      iframe.contentWindow?.print()
      setTimeout(() => {
        document.body.removeChild(iframe)
        URL.revokeObjectURL(url)
      }, 60_000)
    }
  } catch {
    alert('Failed to print payslip. Please try again.')
  }
}

export default function MyPayslipsView({ employeeName }: Props) {
  const router = useRouter()
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['payslips', 'me'],
    queryFn: () => getMyPayslips(),
    staleTime: 2 * 60 * 1000,
  })

  const fetchError: string | null =
    data && data.success === false ? (data.error ?? 'Failed to load payslips') : null
  const allPayslips: Payslip[] = Array.isArray(data?.data) ? data.data : []

  // Build year list from payslips
  const years = Array.from(new Set(allPayslips.map((p) => getYear(p.cycleStartDate)))).sort(
    (a, b) => b - a
  )

  const displayed = allPayslips.filter((p) => {
    if (selectedYear === 'all') return true
    return getYear(p.cycleStartDate) === selectedYear
  })

  // Stats
  const totalNetPay = displayed.reduce((sum, p) => {
    const pd = p.payslipData as Record<string, unknown>
    return sum + (typeof pd.netPay === 'number' ? pd.netPay : 0)
  }, 0)

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Payslips</h1>
            <p className="mt-1 text-sm text-gray-500">{employeeName}</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Summary banner */}
        {displayed.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                Total Payslips
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{displayed.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedYear === 'all' ? 'All time' : String(selectedYear)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm sm:col-span-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                Total Net Pay
              </p>
              <p className="text-2xl font-bold text-purple-700 mt-1">{fmt(totalNetPay)}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {selectedYear === 'all' ? 'All time' : String(selectedYear)}
              </p>
            </div>
          </div>
        )}

        {/* Year filter */}
        {years.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedYear('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedYear === 'all'
                  ? 'bg-purple-700 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-300'
              }`}
            >
              All Years
            </button>
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedYear === y
                    ? 'bg-purple-700 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-300'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        {/* Error banner */}
        {fetchError && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            {fetchError.toLowerCase().includes('403') ||
            fetchError.toLowerCase().includes('permission') ||
            fetchError.toLowerCase().includes('forbidden') ? (
              <Lock size={18} className="mt-0.5 shrink-0 text-red-500" />
            ) : (
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
            )}
            <div>
              <p className="text-sm font-medium text-red-700">
                {fetchError.toLowerCase().includes('403') ||
                fetchError.toLowerCase().includes('forbidden')
                  ? 'Access denied'
                  : 'Could not load payslips'}
              </p>
              <p className="mt-0.5 text-xs text-red-600">
                {fetchError.toLowerCase().includes('403') ||
                fetchError.toLowerCase().includes('forbidden')
                  ? 'You do not have permission to view payslips. Please contact your administrator to grant you access.'
                  : fetchError}
              </p>
            </div>
          </div>
        )}

        {/* Payslip cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse space-y-3"
              >
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="h-14 bg-gray-100 rounded-lg" />
                  <div className="h-14 bg-gray-100 rounded-lg" />
                  <div className="h-14 bg-purple-100 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <FileText size={48} strokeWidth={1.5} />
            <p className="text-base font-medium text-gray-500">No payslips available</p>
            <p className="text-sm text-gray-400">
              Your payslips will appear here once they are processed.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map((payslip) => (
              <PayslipCard
                key={payslip.id}
                payslip={payslip}
                onClick={() => router.push(`/human-resource/payslips/${payslip.id}`)}
                onPrint={(e) => {
                  e.stopPropagation()
                  printPayslip(payslip.id)
                }}
                onDownload={(e) => {
                  e.stopPropagation()
                  downloadPayslip(payslip.id)
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
