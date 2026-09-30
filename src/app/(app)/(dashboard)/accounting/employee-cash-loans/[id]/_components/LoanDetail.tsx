'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, HandCoins, Pencil, Printer } from 'lucide-react'
import { getEmployeeCashLoan } from '../../_actions/get-loan'
import { hasPermission } from '@/src/hooks/usePermission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { EmployeeCashLoan } from '@/src/schema/accounting/employee-cash-loans'
import { getBusinessProfile, type BusinessProfile } from '@/src/libs/actions/enterprise.actions'
import {
  printEmployeeCashLoanVoucherDocument,
  type PrintDocumentEnvelope,
} from '@/src/libs/print/printInventoryDocument'

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

function borrowerLabel(loan: EmployeeCashLoan): string {
  return loan.borrowerType === 'OTHER'
    ? (loan.borrowerName ?? 'Others')
    : loan.employee
      ? `${loan.employee.firstName} ${loan.employee.lastName}`
      : '—'
}

type LedgerRow = {
  date: string
  description: string
  debit: number
  credit: number
  balance: number
}

function buildLedger(loan: EmployeeCashLoan): LedgerRow[] {
  const rows: Omit<LedgerRow, 'balance'>[] = [
    { date: loan.loanDate, description: 'Loan disbursed', debit: loan.totalReceivable, credit: 0 },
    ...loan.payments.map((p) => ({
      date: p.paymentDate,
      description: p.referenceNumber ? `Payment (${p.referenceNumber})` : 'Payment',
      debit: 0,
      credit: p.amount,
    })),
  ]
  let running = 0
  return rows.map((r) => {
    running = Math.round((running + r.debit - r.credit) * 100) / 100
    return { ...r, balance: running }
  })
}

function buildVoucherEnvelope(
  loan: EmployeeCashLoan,
  profile: BusinessProfile | null
): PrintDocumentEnvelope {
  return {
    documentType: 'EMPLOYEE_CASH_LOAN_VOUCHER',
    documentNumber: loan.loanNumber,
    generatedAt: new Date().toISOString(),
    enterprise: profile
      ? {
          companyLegalName: profile.companyLegalName ?? '',
          companyTradingName: profile.companyTradingName ?? undefined,
          address: profile.address ?? undefined,
        }
      : null,
    document: {
      borrowerLabel: borrowerLabel(loan),
      borrowerType: loan.borrowerType,
      loanNumber: loan.loanNumber,
      loanDate: loan.loanDate,
      referenceNumber: loan.referenceNumber,
      principal: loan.principal,
      totalInterest: loan.totalInterest,
      totalReceivable: loan.totalReceivable,
      disbursementMethod: loan.disbursementMethod,
      bankAccountName: loan.bankAccount?.name,
      note: loan.note,
      scheduleLines: loan.scheduleLines,
      payments: loan.payments,
    },
  }
}

function printVoucher(loan: EmployeeCashLoan, profile: BusinessProfile | null) {
  printEmployeeCashLoanVoucherDocument(buildVoucherEnvelope(loan, profile))
}

export default function LoanDetail({ id, session }: { id: string; session: SessionUser }) {
  const canEdit = hasPermission(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_CASH_LOAN_CREATE)
  const canPay = hasPermission(session, ACCOUNTING_PERMISSIONS.EMPLOYEE_CASH_LOAN_PAY)
  const [loan, setLoan] = useState<EmployeeCashLoan | null>(null)
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [res, profileRes] = await Promise.all([getEmployeeCashLoan(id), getBusinessProfile()])
    if (res.success && res.data) {
      setLoan(res.data)
    } else {
      setNotFound(true)
    }
    if (profileRes.success && profileRes.data) {
      setBusinessProfile(profileRes.data)
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
          href="/accounting/employee-cash-loans"
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

  const isOther = loan.borrowerType === 'OTHER'
  const ledger = isOther ? buildLedger(loan) : []

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/accounting/employee-cash-loans"
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
            <p className="mt-1 text-sm text-zinc-500">
              {borrowerLabel(loan)}
              {isOther && <span className="ml-2 text-xs text-zinc-400">(Others)</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[loan.status] ?? 'bg-prominent-purple-50 text-prominent-purple-700'}`}
            >
              {loan.status.replace('_', ' ')}
            </span>
            <button
              type="button"
              onClick={() => printVoucher(loan, businessProfile)}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Printer className="h-4 w-4" /> Print Voucher
            </button>
            {isOther && canPay && loan.status === 'ACTIVE' && (
              <Link
                href={`/accounting/employee-cash-loans/${id}/pay`}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <HandCoins className="h-4 w-4" /> Pay
              </Link>
            )}
            {canEdit && (
              <Link
                href={`/accounting/employee-cash-loans/${id}/edit`}
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
                value={loan.interestRate > 0 ? `${(loan.interestRate * 100).toFixed(2)}%` : 'None'}
              />
              {loan.totalInterest > 0 && (
                <Row label="Total Interest" value={fmt(loan.totalInterest)} />
              )}
              <Row label="Total Amount Receivable" value={fmt(loan.totalReceivable)} bold />
              {!isOther && (
                <>
                  <Row label="Term" value={`${loan.termMonths} months`} />
                  <Row label="Monthly Principal" value={fmt(loan.monthlyPrincipal ?? 0)} />
                  <Row label="Monthly Interest" value={fmt(loan.monthlyInterest ?? 0)} />
                  <Row
                    label="Monthly Installment/Deduction"
                    value={fmt(loan.monthlyDeduction ?? 0)}
                    bold
                  />
                </>
              )}
              <Row label="Loan Date" value={fmtDate(loan.loanDate)} />
              {!isOther && loan.firstDeductionDate && (
                <Row label="First Due Date" value={fmtDate(loan.firstDeductionDate)} />
              )}
              {!isOther && loan.finalDueDate && (
                <Row label="Final Due Date" value={fmtDate(loan.finalDueDate)} />
              )}
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

        {isOther ? (
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-zinc-700">Ledger</h3>
              <p className="text-xs text-zinc-400">
                No fixed schedule — paid back any amount, any time.
              </p>
            </div>
            <div className="scroll-fade-x overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <Th>Date</Th>
                    <Th>Description</Th>
                    <Th align="right">Debit</Th>
                    <Th align="right">Credit</Th>
                    <Th align="right">Balance</Th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((r, i) => (
                    <tr key={i} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-2 text-prominent-purple-900">{fmtDate(r.date)}</td>
                      <td className="px-4 py-2 text-prominent-purple-900">{r.description}</td>
                      <td className="px-4 py-2 text-right text-prominent-purple-900">
                        {r.debit ? fmt(r.debit) : ''}
                      </td>
                      <td className="px-4 py-2 text-right text-prominent-purple-900">
                        {r.credit ? fmt(r.credit) : ''}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-prominent-purple-900">
                        {fmt(r.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
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
                    <Th>#</Th>
                    <Th>Due Date</Th>
                    <Th align="right">Principal</Th>
                    <Th align="right">Interest</Th>
                    <Th align="right">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {loan.scheduleLines.map((line) => (
                    <tr key={line.id} className="border-b border-zinc-100 last:border-0">
                      <td className="px-4 py-2 text-zinc-500">{line.lineNumber}</td>
                      <td className="px-4 py-2 text-prominent-purple-900">
                        {fmtDate(line.dueDate)}
                      </td>
                      <td className="px-4 py-2 text-right text-prominent-purple-900">
                        {fmt(line.principalAmount)}
                      </td>
                      <td className="px-4 py-2 text-right text-prominent-purple-900">
                        {fmt(line.interestAmount)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-prominent-purple-900">
                        {fmt(line.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd
        className={
          bold ? 'font-semibold text-prominent-purple-700' : 'font-medium text-prominent-purple-900'
        }
      >
        {value}
      </dd>
    </div>
  )
}
