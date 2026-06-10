'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, Printer, Download, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import { getPayslip } from '../_actions/payslip-actions'
import EditPayslipModal from './EditPayslipModal'
import DeletePayslipModal from './DeletePayslipModal'
import type { Payslip } from '@/src/schema/human-resource/payslips'

interface Props {
  payslipId: string
  canEdit: boolean
}

function formatDate(iso: string) {
  return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function fmt(n: unknown) {
  if (typeof n !== 'number' || isNaN(n)) return '—'
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(n)
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between py-2.5 border-b border-gray-100 last:border-0 ${bold ? 'font-semibold' : ''}`}
    >
      <span className={`text-sm ${bold ? 'text-gray-800' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-sm ${bold ? 'text-gray-900' : 'text-gray-700'}`}>{value}</span>
    </div>
  )
}

export default function PayslipDetailView({ payslipId, canEdit }: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['payslip', payslipId],
    queryFn: () => getPayslip(payslipId),
    enabled: !!payslipId,
    staleTime: 2 * 60 * 1000,
  })

  const payslip: Payslip | undefined = data?.data
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
      <div className="min-h-full bg-zinc-50 px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse h-10 bg-gray-200 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!payslip) {
    return (
      <div className="min-h-full bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Payslip not found.</p>
          <button
            onClick={() => router.back()}
            className="mt-3 text-sm text-purple-600 hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  const employeeName = payslip.employee
    ? `${payslip.employee.firstName} ${payslip.employee.lastName}`
    : payslip.employeeId

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Download size={14} className={downloading ? 'animate-bounce' : ''} />
              {downloading ? 'Downloading…' : 'Download'}
            </button>
            <button
              onClick={handlePrint}
              disabled={printing}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Printer size={14} className={printing ? 'animate-pulse' : ''} />
              {printing ? 'Preparing…' : 'Print'}
            </button>
            {canEdit && (
              <>
                <button
                  onClick={() => setEditOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Card header */}
          <div className="bg-purple-700 px-6 py-5 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-purple-300 uppercase tracking-wider">Payslip</p>
                <h2 className="mt-1 text-xl font-bold">{employeeName}</h2>
                {payslip.employee?.employeeCode && (
                  <p className="text-sm text-purple-300">{payslip.employee.employeeCode}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-purple-300">Cycle #{payslip.cycle}</p>
                <p className="mt-1 text-sm">
                  {formatDate(payslip.cycleStartDate)} — {formatDate(payslip.cycleEndDate)}
                </p>
                <div className="mt-2">
                  {payslip.visibility ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-200">
                      <Eye size={10} /> Visible
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white/70">
                      <EyeOff size={10} /> Hidden
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Attendance summary */}
          {isGenerated && (
            <>
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Days Present</p>
                  <p className="text-base font-semibold text-gray-800 mt-0.5">
                    {String(pd.numberOfDays ?? '—')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Actual Days</p>
                  <p className="text-base font-semibold text-gray-800 mt-0.5">
                    {String(pd.actualNumberOfDays ?? '—')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Daily Rate</p>
                  <p className="text-base font-semibold text-gray-800 mt-0.5">
                    {fmt(pd.dailyRate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Gross Pay</p>
                  <p className="text-base font-semibold text-gray-800 mt-0.5">{fmt(pd.grossPay)}</p>
                </div>
              </div>
              {specialHours.length > 0 && (
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    Special Hours
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5">
                    {specialHours.map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-medium text-gray-700">{value} hrs</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Earnings */}
          <div className="px-6 py-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Earnings
            </h3>
            {isGenerated ? (
              <>
                <Row label="Total Amount" value={fmt(pd.total)} />
                <Row label="Allowance" value={fmt(pd.allowance)} />
                {Number(pd.specialIncentives) > 0 && (
                  <Row label="Special Incentives" value={fmt(pd.specialIncentives)} />
                )}
                {Number(pd.reconciliationPay) > 0 && (
                  <Row label="Reconciliation Pay" value={fmt(pd.reconciliationPay)} />
                )}
                {Number(pd.thirteenthMonthPay) > 0 && (
                  <Row label="13th Month Pay" value={fmt(pd.thirteenthMonthPay)} />
                )}
                <Row label="Total Income" value={fmt(pd.totalIncome)} bold />
              </>
            ) : (
              <>
                <Row label="Basic Pay" value={fmt(pd.basicPay)} />
                <Row label="Allowances" value={fmt(pd.allowances)} />
                <Row label="Gross Pay" value={fmt(pd.grossPay)} bold />
              </>
            )}
          </div>

          {/* Deductions */}
          <div className="px-6 py-4 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Deductions
            </h3>
            {isGenerated ? (
              <>
                <Row label="Withholding Tax" value={fmt(pd.incomeTaxDeduction)} />
                <Row label="SSS" value={fmt(pd.sss)} />
                <Row label="PhilHealth" value={fmt(pd.philHealth)} />
                <Row label="Pag-IBIG" value={fmt(pd.pagIbig)} />
                {Number(pd.loan) > 0 && <Row label="Loan Deduction" value={fmt(pd.loan)} />}
                <Row label="Total Deductions" value={fmt(pd.totalDeduction)} bold />
              </>
            ) : (
              <Row label="Total Deductions" value={fmt(pd.deductions)} bold />
            )}
          </div>

          {/* Net Pay */}
          <div className="px-6 py-5 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
            <span className="text-base font-semibold text-gray-700">Net Pay</span>
            <span className="text-2xl font-bold text-purple-700">{fmt(pd.netPay)}</span>
          </div>

          {/* Loan balance */}
          {isGenerated && Number(pd.loanBalance) > 0 && (
            <div className="px-6 py-3 border-t border-gray-100 flex justify-between text-sm text-gray-500">
              <span>Remaining Loan Balance</span>
              <span className="font-medium text-gray-700">{fmt(pd.loanBalance)}</span>
            </div>
          )}

          {/* Notes */}
          {typeof pd.notes === 'string' && pd.notes && (
            <div className="px-6 py-4 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Notes
              </h3>
              <p className="text-sm text-gray-600">{pd.notes}</p>
            </div>
          )}
          {typeof pd.notes === 'number' && pd.notes !== 0 && (
            <div className="px-6 py-4 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Notes
              </h3>
              <p className="text-sm text-gray-600">{String(pd.notes)}</p>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-6 py-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Details
          </h3>
          <Row label="Payslip ID" value={<span className="font-mono text-xs">{payslip.id}</span>} />
          {payslip.payrollPeriodId && (
            <Row
              label="Payroll Period ID"
              value={<span className="font-mono text-xs">{payslip.payrollPeriodId}</span>}
            />
          )}
          <Row
            label="Created"
            value={new Date(payslip.createdAt).toLocaleDateString('en-PH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          />
          <Row
            label="Last Updated"
            value={new Date(payslip.updatedAt).toLocaleDateString('en-PH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          />
        </div>
      </div>

      {canEdit && editOpen && (
        <EditPayslipModal
          payslip={payslip}
          onClose={() => setEditOpen(false)}
          onSuccess={() => {
            setEditOpen(false)
            refetch()
          }}
        />
      )}
      {canEdit && deleteOpen && (
        <DeletePayslipModal
          payslip={payslip}
          onClose={() => setDeleteOpen(false)}
          onSuccess={() => router.back()}
        />
      )}
    </div>
  )
}
