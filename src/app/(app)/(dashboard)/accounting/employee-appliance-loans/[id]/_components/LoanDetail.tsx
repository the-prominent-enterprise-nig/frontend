'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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

export default function LoanDetail({ id }: { id: string }) {
  const [loan, setLoan] = useState<EmployeeApplianceLoan | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payNote, setPayNote] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await EmployeeApplianceLoans.get(id)
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

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setPayError(null)
    const amount = Number(payAmount)
    if (!amount || amount <= 0) {
      setPayError('Enter an amount greater than 0.')
      return
    }
    if (loan && amount > Number(loan.currentBalance)) {
      setPayError(`Amount exceeds the outstanding balance (${fmtMoney(loan.currentBalance)}).`)
      return
    }
    setPaying(true)
    const res = await EmployeeApplianceLoans.recordPayment(id, {
      amount,
      paymentDate: payDate,
      note: payNote || undefined,
    })
    setPaying(false)
    if (!res.success) {
      setPayError(res.message || res.error || 'Payment failed')
      return
    }
    setPayAmount('')
    setPayNote('')
    load()
  }

  if (loading) {
    return <div className="px-6 py-8 lg:px-10 text-sm text-gray-400">Loading…</div>
  }
  if (notFound || !loan) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <Link
          href="/accounting/employee-appliance-loans"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to employee appliance loans
        </Link>
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          Loan not found.
        </div>
      </div>
    )
  }

  const employeeName = loan.employee ? `${loan.employee.firstName} ${loan.employee.lastName}` : '—'

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/accounting/employee-appliance-loans"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to employee appliance loans
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{loan.loanNumber}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {employeeName} — {loan.itemDescription}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[loan.status] ?? 'bg-purple-50 text-purple-700'}`}
        >
          {loan.status.replace('_', ' ')}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-700">Financing Terms</h3>
          <dl className="space-y-1.5 text-sm">
            <Row label="Listed Cash Price" value={fmtMoney(loan.listedCashPrice)} />
            <Row label="Down Payment" value={fmtMoney(loan.downPayment)} />
            <Row label="Amount Financed" value={fmtMoney(loan.amountFinanced)} />
            <Row label="Monthly Installment" value={fmtMoney(loan.monthlyInstallment)} />
            <Row label="Term" value={`${loan.termMonths} months`} />
            <Row label="PNV" value={fmtMoney(loan.pnv)} />
            <Row label="Total Price" value={fmtMoney(loan.totalPrice)} />
            <Row label="Interest Differential" value={fmtMoney(loan.interestDifferential)} />
            <Row label="PPD" value={fmtMoney(loan.ppd)} />
            <Row label="Start Date" value={fmtDate(loan.startDate)} />
            {loan.nextDueDate && <Row label="Next Due Date" value={fmtDate(loan.nextDueDate)} />}
          </dl>
          <div className="mt-4 pt-4 border-t flex justify-between text-base">
            <span className="font-semibold text-gray-700">Outstanding Balance</span>
            <span className="font-bold text-purple-700">{fmtMoney(loan.currentBalance)}</span>
          </div>
        </div>

        <div className="space-y-4">
          {loan.status === 'ACTIVE' && (
            <form
              onSubmit={recordPayment}
              className="space-y-3 rounded-xl border border-gray-200 bg-white p-6"
            >
              <h3 className="text-sm font-semibold text-gray-700">Record Payment</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Amount *">
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  />
                </Field>
                <Field label="Date *">
                  <input
                    required
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  />
                </Field>
              </div>
              <Field label="Note">
                <input
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                />
              </Field>
              {payError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {payError}
                </div>
              )}
              <button
                type="submit"
                disabled={paying}
                className="w-full px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
              >
                {paying ? 'Recording...' : 'Record Payment'}
              </button>
            </form>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment History</h3>
            {!loan.payments || loan.payments.length === 0 ? (
              <p className="text-sm text-gray-400">No payments recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-gray-500">
                  <tr>
                    <th className="text-left pb-2">Date</th>
                    <th className="text-right pb-2">Amount</th>
                    <th className="text-left pb-2">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loan.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2">{fmtDate(p.paymentDate)}</td>
                      <td className="py-2 text-right">{fmtMoney(p.amount)}</td>
                      <td className="py-2 text-gray-500">{p.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
