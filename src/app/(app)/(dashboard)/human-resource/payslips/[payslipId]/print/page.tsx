'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, Printer, Download } from 'lucide-react'
import { getPayslip } from '../../_actions/payslip-actions'

function formatDate(iso: string) {
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function fmt(n: unknown) {
  if (typeof n !== 'number' || isNaN(n)) return '₱ 0.00'
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(n)
}

function PrintRow({ label, value, indent }: { label: string; value: string; indent?: boolean }) {
  return (
    <div
      className={`flex justify-between py-1.5 border-b border-gray-100 last:border-0 ${indent ? 'pl-3' : ''}`}
    >
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-1 mb-2 mt-5 first:mt-0">
      {title}
    </h2>
  )
}

export default function PrintPayslipPage() {
  const { payslipId } = useParams<{ payslipId: string }>()
  const router = useRouter()
  const [downloading, setDownloading] = useState(false)
  const [printing, setPrinting] = useState(false)

  async function fetchPdfBlob(): Promise<Blob> {
    const res = await fetch(`/api/payslips/${payslipId}/download`)
    if (!res.ok) throw new Error('Download failed')
    return res.blob()
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const blob = await fetchPdfBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payslip-${payslipId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Failed to download payslip. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  async function handlePrint() {
    setPrinting(true)
    try {
      const blob = await fetchPdfBlob()
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
    } finally {
      setPrinting(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['payslip', payslipId],
    queryFn: () => getPayslip(payslipId),
    enabled: !!payslipId,
    staleTime: 2 * 60 * 1000,
  })

  const payslip = data?.data
  const pd = (payslip?.payslipData ?? {}) as Record<string, unknown>
  const isGenerated = 'totalIncome' in pd || 'incomeTaxDeduction' in pd

  const specialHours = Object.entries(pd)
    .filter(
      ([key, val]) => (key.startsWith('holiday_') || key.startsWith('weekend_')) && Number(val) > 0
    )
    .map(([key, val]) => {
      const isHoliday = key.startsWith('holiday_')
      const datePart = key.replace(/^(holiday|weekend)_/, '').replace(/_hours$/, '')
      const label = new Date(datePart + 'T00:00:00').toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      return { label: `${isHoliday ? 'Holiday' : 'Weekend'} — ${label}`, value: val as number }
    })

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400 text-sm">Loading payslip...</p>
      </div>
    )
  }

  if (!payslip) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Payslip not found.</p>
      </div>
    )
  }

  const employeeName = payslip.employee
    ? `${payslip.employee.firstName} ${payslip.employee.lastName}`
    : payslip.employeeId

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Screen-only controls */}
      <div className="print:hidden bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download size={14} className={downloading ? 'animate-bounce' : ''} />
            {downloading ? 'Downloading…' : 'Download PDF'}
          </button>
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50"
          >
            <Printer size={14} className={printing ? 'animate-pulse' : ''} />
            {printing ? 'Preparing…' : 'Print'}
          </button>
        </div>
      </div>

      {/* Printable area */}
      <div className="max-w-2xl mx-auto my-8 print:my-0 bg-white shadow-lg print:shadow-none">
        <div className="p-10">
          {/* Document header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payslip</h1>
              <p className="text-sm text-gray-500 mt-1">
                Cycle #{payslip.cycle} &mdash; {formatDate(payslip.cycleStartDate)} to{' '}
                {formatDate(payslip.cycleEndDate)}
              </p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>
                ID: <span className="font-mono">{payslip.id.slice(0, 8)}…</span>
              </p>
              <p>
                Printed:{' '}
                {new Date().toLocaleDateString('en-PH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Employee info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Employee</p>
            <p className="text-lg font-semibold text-gray-900">{employeeName}</p>
            {payslip.employee?.employeeCode && (
              <p className="text-sm text-gray-500">{payslip.employee.employeeCode}</p>
            )}
          </div>

          {/* Attendance summary for generated payslips */}
          {isGenerated && (
            <>
              <SectionHeader title="Attendance" />
              <div className="grid grid-cols-4 gap-3 mb-2">
                <div className="text-center bg-gray-50 rounded p-2">
                  <p className="text-xs text-gray-400">Days Present</p>
                  <p className="font-semibold text-gray-800">{String(pd.numberOfDays ?? '—')}</p>
                </div>
                <div className="text-center bg-gray-50 rounded p-2">
                  <p className="text-xs text-gray-400">Actual Days</p>
                  <p className="font-semibold text-gray-800">
                    {String(pd.actualNumberOfDays ?? '—')}
                  </p>
                </div>
                <div className="text-center bg-gray-50 rounded p-2">
                  <p className="text-xs text-gray-400">Daily Rate</p>
                  <p className="font-semibold text-gray-800">{fmt(pd.dailyRate)}</p>
                </div>
                <div className="text-center bg-gray-50 rounded p-2">
                  <p className="text-xs text-gray-400">Gross Pay</p>
                  <p className="font-semibold text-gray-800">{fmt(pd.grossPay)}</p>
                </div>
              </div>
              {specialHours.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-1.5">
                    Special Hours
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-2">
                    {specialHours.map(({ label, value }) => (
                      <PrintRow key={label} label={label} value={`${value} hrs`} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Earnings */}
          <SectionHeader title="Earnings" />
          {isGenerated ? (
            <>
              <PrintRow label="Total Amount" value={fmt(pd.total)} />
              <PrintRow label="Allowance" value={fmt(pd.allowance)} />
              {Number(pd.specialIncentives) > 0 && (
                <PrintRow label="Special Incentives" value={fmt(pd.specialIncentives)} />
              )}
              {Number(pd.reconciliationPay) > 0 && (
                <PrintRow label="Reconciliation Pay" value={fmt(pd.reconciliationPay)} />
              )}
              {Number(pd.thirteenthMonthPay) > 0 && (
                <PrintRow label="13th Month Pay" value={fmt(pd.thirteenthMonthPay)} />
              )}
              <div className="flex justify-between py-2 font-semibold border-t border-gray-200 mt-1">
                <span className="text-sm">Total Income</span>
                <span className="text-sm">{fmt(pd.totalIncome)}</span>
              </div>
            </>
          ) : (
            <>
              <PrintRow label="Basic Pay" value={fmt(pd.basicPay)} />
              <PrintRow label="Allowances" value={fmt(pd.allowances)} />
              <div className="flex justify-between py-2 font-semibold border-t border-gray-200 mt-1">
                <span className="text-sm">Gross Pay</span>
                <span className="text-sm">{fmt(pd.grossPay)}</span>
              </div>
            </>
          )}

          {/* Deductions */}
          <SectionHeader title="Deductions" />
          {isGenerated ? (
            <>
              <PrintRow label="Withholding Tax" value={fmt(pd.incomeTaxDeduction)} />
              <PrintRow label="SSS" value={fmt(pd.sss)} />
              <PrintRow label="PhilHealth" value={fmt(pd.philHealth)} />
              <PrintRow label="Pag-IBIG" value={fmt(pd.pagIbig)} />
              {Number(pd.loan) > 0 && <PrintRow label="Loan Deduction" value={fmt(pd.loan)} />}
              <div className="flex justify-between py-2 font-semibold border-t border-gray-200 mt-1">
                <span className="text-sm">Total Deductions</span>
                <span className="text-sm">{fmt(pd.totalDeduction)}</span>
              </div>
            </>
          ) : (
            <PrintRow label="Total Deductions" value={fmt(pd.deductions)} />
          )}

          {/* Net Pay */}
          <div className="bg-purple-700 rounded-lg px-5 py-4 flex justify-between items-center text-white mt-6">
            <span className="font-semibold">Net Pay</span>
            <span className="text-2xl font-bold">{fmt(pd.netPay)}</span>
          </div>

          {/* Loan balance */}
          {isGenerated && Number(pd.loanBalance) > 0 && (
            <div className="mt-3 flex justify-between text-sm text-gray-500">
              <span>Remaining Loan Balance</span>
              <span className="font-medium">{fmt(pd.loanBalance)}</span>
            </div>
          )}

          {/* Notes */}
          {typeof pd.notes === 'string' && pd.notes && (
            <div className="mt-4 text-sm text-gray-500">
              <span className="font-medium text-gray-700">Notes: </span>
              {pd.notes}
            </div>
          )}

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-gray-200 flex justify-between text-xs text-gray-400">
            <span>Generated by Prominent Enterprise System</span>
            <span>Confidential</span>
          </div>
        </div>
      </div>
    </div>
  )
}
