'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Printer } from 'lucide-react'
import { getEmployeeCashLoan } from '../../_actions/get-loan'
import { hasPermission } from '@/src/hooks/usePermission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { EmployeeCashLoan } from '@/src/schema/pos/employee-cash-loans'

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  PAID_OFF: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-50 text-red-600',
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PH')
}

function printVoucher(loan: EmployeeCashLoan) {
  const employeeName = loan.employee ? `${loan.employee.firstName} ${loan.employee.lastName}` : '—'
  const scheduleRows = loan.scheduleLines
    .map(
      (l) =>
        `<tr><td>${l.lineNumber}</td><td>${fmtDate(l.dueDate)}</td><td style="text-align:right">${fmt(l.principalAmount)}</td><td style="text-align:right">${fmt(l.interestAmount)}</td><td style="text-align:right">${fmt(l.totalAmount)}</td></tr>`
    )
    .join('')

  const html = `<!DOCTYPE html><html><head><title>EMPLOYEE CASH LOAN — ${loan.loanNumber}</title>
<style>
  body{font-family:monospace;font-size:12px;max-width:460px;margin:0 auto;padding:16px}
  .banner{background:#000;color:#fff;text-align:center;padding:6px 0;font-size:14px;font-weight:bold;letter-spacing:2px;margin-bottom:10px}
  .center{text-align:center;margin:3px 0;color:#555}
  hr{border:none;border-top:1px dashed #aaa;margin:8px 0}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;color:#888;padding:2px 4px}
  td{padding:3px 4px}
  .row{display:flex;justify-content:space-between;padding:2px 0}
  .sig{margin-top:24px}
  .sig-line{border-top:1px solid #333;margin-top:36px;padding-top:4px;font-size:10px;color:#666}
  .footer{text-align:center;font-size:10px;color:#aaa;margin-top:10px}
  @media print{.no-print{display:none}}
</style></head><body>
<div class="banner">EMPLOYEE CASH LOAN</div>
<p class="center" style="font-weight:bold">${loan.loanNumber}</p>
<p class="center">${fmtDate(loan.loanDate)}</p>
<hr>
<div class="row"><span>Employee</span><span>${employeeName}</span></div>
<div class="row"><span>Employee code</span><span>${loan.employee?.employeeCode ?? '—'}</span></div>
<hr>
<div class="row"><span>Principal Amount</span><span>${fmt(loan.principal)}</span></div>
<div class="row"><span>Interest Rate / Loan Factor</span><span>${(loan.interestRate * 100).toFixed(2)}%</span></div>
<div class="row"><span>Total Interest</span><span>${fmt(loan.totalInterest)}</span></div>
<div class="row" style="font-weight:bold"><span>Total Amount Receivable</span><span>${fmt(loan.totalReceivable)}</span></div>
<div class="row"><span>Term</span><span>${loan.termMonths} months</span></div>
<div class="row" style="font-weight:bold"><span>Monthly Installment/Deduction</span><span>${fmt(loan.monthlyDeduction)}</span></div>
<div class="row"><span>First Due Date</span><span>${fmtDate(loan.firstDeductionDate)}</span></div>
<div class="row"><span>Final Due Date</span><span>${fmtDate(loan.finalDueDate)}</span></div>
<hr>
<div class="row"><span>Disbursement Method</span><span>${loan.disbursementMethod.replace('_', ' ')}</span></div>
${loan.bankAccount ? `<div class="row"><span>Bank / Cash Account</span><span>${loan.bankAccount.name}</span></div>` : ''}
${loan.referenceNumber ? `<div class="row"><span>Reference / Voucher No.</span><span>${loan.referenceNumber}</span></div>` : ''}
${loan.note ? `<hr><p>Note: ${loan.note}</p>` : ''}
<hr>
<table><thead><tr><th>#</th><th>Due</th><th style="text-align:right">Principal</th><th style="text-align:right">Interest</th><th style="text-align:right">Total</th></tr></thead><tbody>${scheduleRows}</tbody></table>
<div class="sig">
  <div class="sig-line">Employee signature</div>
  <div class="sig-line">Cashier signature</div>
</div>
<p class="footer">Repayment is not deducted automatically yet — recovered via payroll/Accounting.</p>
<button class="no-print" onclick="window.print()" style="display:block;margin:12px auto;padding:6px 20px;cursor:pointer;font-size:12px">Print</button>
</body></html>`

  const w = window.open('', '_blank', 'width=460,height=720,scrollbars=yes')
  if (w) {
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
  }
}

export default function LoanDetail({ id, session }: { id: string; session: SessionUser }) {
  const canEdit = hasPermission(session, POS_PERMISSIONS.EMPLOYEE_CASH_LOAN_CREATE)
  const [loan, setLoan] = useState<EmployeeCashLoan | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getEmployeeCashLoan(id)
    if (res.success && res.data) {
      setLoan(res.data)
    } else {
      setNotFound(true)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <div className="px-6 py-8 text-sm text-zinc-400 lg:px-10">Loading…</div>
  }
  if (notFound || !loan) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <Link
          href="/pos/employee-cash-loans"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employee Cash Loans
        </Link>
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Loan not found.
        </div>
      </div>
    )
  }

  const employeeName = loan.employee ? `${loan.employee.firstName} ${loan.employee.lastName}` : '—'

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/pos/employee-cash-loans"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employee Cash Loans
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-prominent-purple-900 md:text-3xl">
              {loan.loanNumber}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{employeeName}</p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[loan.status] ?? 'bg-prominent-purple-50 text-prominent-purple-700'}`}
            >
              {loan.status.replace('_', ' ')}
            </span>
            <button
              type="button"
              onClick={() => printVoucher(loan)}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Printer className="h-4 w-4" /> Print Voucher
            </button>
            {canEdit && (
              <Link
                href={`/pos/employee-cash-loans/${id}/edit`}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-3 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-zinc-700">Financing Terms</h3>
            <dl className="space-y-1.5 text-sm">
              <Row label="Principal Amount" value={fmt(loan.principal)} />
              <Row
                label="Interest Rate / Loan Factor"
                value={`${(loan.interestRate * 100).toFixed(2)}%`}
              />
              <Row label="Total Interest" value={fmt(loan.totalInterest)} />
              <Row label="Total Amount Receivable" value={fmt(loan.totalReceivable)} bold />
              <Row label="Term" value={`${loan.termMonths} months`} />
              <Row label="Monthly Principal" value={fmt(loan.monthlyPrincipal)} />
              <Row label="Monthly Interest" value={fmt(loan.monthlyInterest)} />
              <Row label="Monthly Installment/Deduction" value={fmt(loan.monthlyDeduction)} bold />
              <Row label="Loan Date" value={fmtDate(loan.loanDate)} />
              <Row label="First Due Date" value={fmtDate(loan.firstDeductionDate)} />
              <Row label="Final Due Date" value={fmtDate(loan.finalDueDate)} />
            </dl>
          </div>

          <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-1 text-sm font-semibold text-zinc-700">Disbursement & Balance</h3>
            <dl className="space-y-1.5 text-sm">
              <Row label="Disbursement Method" value={loan.disbursementMethod.replace('_', ' ')} />
              {loan.bankAccount && (
                <Row label="Bank / Cash Account" value={loan.bankAccount.name} />
              )}
              {loan.referenceNumber && (
                <Row label="Reference / Voucher No." value={loan.referenceNumber} />
              )}
              <Row label="Opening Balance" value={fmt(loan.openingBalance)} />
              <Row label="Outstanding Balance" value={fmt(loan.currentBalance)} bold />
            </dl>
            {loan.note && <p className="mt-3 text-sm text-zinc-500">Note: {loan.note}</p>}
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-700">Schedule</h3>
            <p className="text-xs text-zinc-400">
              Read-only — repayment recording isn&apos;t built into POS yet.
            </p>
          </div>
          <div className="scroll-fade-x overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    #
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Due Date
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Principal
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Interest
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {loan.scheduleLines.map((line) => (
                  <tr key={line.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-2 text-zinc-500">{line.lineNumber}</td>
                    <td className="px-4 py-2 text-zinc-900">{fmtDate(line.dueDate)}</td>
                    <td className="px-4 py-2 text-right text-zinc-900">
                      {fmt(line.principalAmount)}
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-900">
                      {fmt(line.interestAmount)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-zinc-900">
                      {fmt(line.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd
        className={bold ? 'font-semibold text-prominent-purple-700' : 'font-medium text-zinc-900'}
      >
        {value}
      </dd>
    </div>
  )
}
