'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CategorySelect from '@/src/components/ui/CategorySelect'
import { getEmployeeCashLoan } from '../../../_actions/get-loan'
import { payEmployeeCashLoan } from '../../../_actions/pay-cash-loan'
import {
  listEmployeeCashLoanBankAccounts,
  type EmployeeCashLoanBankAccount,
} from '../../../_actions/list-bank-accounts'
import type { EmployeeCashLoan } from '@/src/schema/accounting/employee-cash-loans'

function fmt(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

export default function PayLoanForm({ id }: { id: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [loan, setLoan] = useState<EmployeeCashLoan | null>(null)
  const [bankAccounts, setBankAccounts] = useState<EmployeeCashLoanBankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [bankAccountId, setBankAccountId] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listEmployeeCashLoanBankAccounts().then((res) => {
      if (res.success && res.data) setBankAccounts(res.data)
    })
    getEmployeeCashLoan(id).then((res) => {
      if (res.success && res.data) {
        setLoan(res.data)
      } else {
        setNotFound(true)
      }
      setLoading(false)
    })
  }, [id])

  const bankAccountOptions = bankAccounts.map((a) => ({
    id: a.id,
    name:
      a.name === a.bankName
        ? `${a.name} (${a.accountNumber})`
        : `${a.name} — ${a.bankName} (${a.accountNumber})`,
    depth: 0,
  }))

  if (loading) {
    return <div className="px-6 py-8 text-sm text-zinc-400 lg:px-10">Loading…</div>
  }

  const backLink = (
    <Link
      href={loan ? `/accounting/employee-cash-loans/${id}` : '/accounting/employee-cash-loans'}
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Loan
    </Link>
  )

  if (notFound || !loan) {
    return (
      <div className="px-6 py-8 lg:px-10">
        {backLink}
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Loan not found.
        </div>
      </div>
    )
  }

  if (loan.borrowerType !== 'OTHER') {
    return (
      <div className="px-6 py-8 lg:px-10">
        {backLink}
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          An Employee loan is recovered via payroll/Accounting — it has no direct Pay action.
        </div>
      </div>
    )
  }

  if (loan.status !== 'ACTIVE') {
    return (
      <div className="px-6 py-8 lg:px-10">
        {backLink}
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          This loan is {loan.status.replace('_', ' ').toLowerCase()} and can&apos;t take a payment.
        </div>
      </div>
    )
  }

  const currentBalance = loan.currentBalance
  const amountNumber = Number(amount) || 0

  const validate = (): string | null => {
    if (amountNumber <= 0) return 'Enter a payment amount.'
    if (amountNumber > currentBalance + 0.01)
      return `Payment can't exceed the remaining balance of ${fmt(currentBalance)}.`
    if (!paymentDate) return 'Enter the payment date.'
    if (!bankAccountId) return 'Pick a Bank / Cash Account.'
    return null
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError(null)
    const res = await payEmployeeCashLoan(id, {
      amount: amountNumber,
      paymentDate,
      bankAccountId,
      referenceNumber: referenceNumber || undefined,
      note: note || undefined,
    })
    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Failed to record the payment')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['pos-employee-cash-loans'] })
    router.push(`/accounting/employee-cash-loans/${id}`)
  }

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-lg">
        {backLink}

        <h1 className="text-2xl font-bold text-prominent-purple-900 md:text-3xl">
          Pay {loan.loanNumber}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {loan.borrowerName} — any amount, any time. Remaining balance:{' '}
          <span className="font-semibold text-prominent-purple-900">{fmt(currentBalance)}</span>
        </p>

        <form
          onSubmit={submit}
          className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <Field label="Amount *">
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={currentBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              autoFocus
            />
          </Field>

          <Field label="Payment Date *">
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Bank / Cash Account *">
            <CategorySelect
              aria-label="Select bank account"
              noun="bank accounts"
              value={bankAccountId}
              onChange={(id) => setBankAccountId(id ?? '')}
              options={bankAccountOptions}
              placeholder="— Select —"
            />
          </Field>

          <Field label="Reference / Voucher No.">
            <input
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Note (optional)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </Field>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-zinc-200 pt-3">
            <Link
              href={`/accounting/employee-cash-loans/${id}`}
              className="rounded-lg px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      {children}
    </label>
  )
}
