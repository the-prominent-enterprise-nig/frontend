'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CategorySelect from '@/src/components/ui/CategorySelect'
import EmployeeSearchCombobox from '../../_components/EmployeeSearchCombobox'
import { getEmployeeCashLoan } from '../../_actions/get-loan'
import { updateEmployeeCashLoan } from '../../_actions/update-cash-loan'
import {
  listEmployeeCashLoanBankAccounts,
  type EmployeeCashLoanBankAccount,
} from '../../_actions/list-bank-accounts'
import type { EmployeeCashLoanBorrowerType } from '@/src/schema/accounting/employee-cash-loans'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

function addCalendarMonths(dateStr: string, months: number): Date | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  d.setMonth(d.getMonth() + months)
  return d
}

// Mirrors EmployeeCashLoansService.computeFinancing (backend) — a live
// preview only; the server recomputes and is the source of truth.
function computeEmployeeFinancing(principal: number, termMonths: number, interestRate: number) {
  const totalInterest = round2(principal * interestRate * termMonths)
  const totalReceivable = round2(principal + totalInterest)
  const monthlyPrincipal = round2(principal / termMonths)
  const monthlyInterest = round2(totalInterest / termMonths)
  return {
    totalInterest,
    totalReceivable,
    monthlyPrincipal,
    monthlyInterest,
    monthlyDeduction: round2(monthlyPrincipal + monthlyInterest),
  }
}

function computeOtherFinancing(principal: number, interestRate: number) {
  const totalInterest = round2(principal * interestRate)
  return { totalInterest, totalReceivable: round2(principal + totalInterest) }
}

type FormState = {
  loanNumber: string
  employeeId: string
  employeeLabel: string
  borrowerName: string
  principal: string
  termMonths: string
  interestRate: string
  chargeInterest: boolean
  loanDate: string
  firstDeductionDate: string
  disbursementMethod: 'CASH' | 'BANK_TRANSFER' | 'CHECK'
  bankAccountId: string
  referenceNumber: string
  note: string
}

export default function EditLoanForm({ id }: { id: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [borrowerType, setBorrowerType] = useState<EmployeeCashLoanBorrowerType>('EMPLOYEE')
  const [hasPayments, setHasPayments] = useState(false)
  const [form, setForm] = useState<FormState | null>(null)
  const [bankAccounts, setBankAccounts] = useState<EmployeeCashLoanBankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listEmployeeCashLoanBankAccounts().then((res) => {
      if (res.success && res.data) setBankAccounts(res.data)
    })
    getEmployeeCashLoan(id).then((res) => {
      if (res.success && res.data) {
        const loan = res.data
        setBorrowerType(loan.borrowerType)
        setHasPayments((loan.payments?.length ?? 0) > 0)
        setForm({
          loanNumber: loan.loanNumber,
          employeeId: loan.employeeId ?? '',
          employeeLabel: loan.employee
            ? [loan.employee.firstName, loan.employee.lastName].filter(Boolean).join(' ')
            : '',
          borrowerName: loan.borrowerName ?? '',
          principal: String(loan.principal),
          termMonths: String(loan.termMonths ?? ''),
          interestRate: String(loan.interestRate),
          chargeInterest: Number(loan.interestRate) > 0,
          loanDate: loan.loanDate.slice(0, 10),
          firstDeductionDate: loan.firstDeductionDate ? loan.firstDeductionDate.slice(0, 10) : '',
          disbursementMethod: loan.disbursementMethod,
          bankAccountId: loan.bankAccountId ?? '',
          referenceNumber: loan.referenceNumber ?? '',
          note: loan.note ?? '',
        })
      } else {
        setNotFound(true)
      }
      setLoading(false)
    })
  }, [id])

  const isOther = borrowerType === 'OTHER'
  const principal = Number(form?.principal) || 0
  const term = Number(form?.termMonths) || 0
  const rate = Number(form?.interestRate) || 0
  const employeePreview =
    !isOther && principal > 0 && term > 0 ? computeEmployeeFinancing(principal, term, rate) : null
  const otherPreview =
    isOther && principal > 0
      ? computeOtherFinancing(principal, form?.chargeInterest ? rate : 0)
      : null
  const firstDueDate = form?.firstDeductionDate ? new Date(form.firstDeductionDate) : null
  const finalDueDate =
    term > 0 && form ? addCalendarMonths(form.firstDeductionDate, term - 1) : null

  const bankAccountOptions = bankAccounts.map((a) => ({
    id: a.id,
    name:
      a.name === a.bankName
        ? `${a.name} (${a.accountNumber})`
        : `${a.name} — ${a.bankName} (${a.accountNumber})`,
    depth: 0,
  }))

  const validate = (f: FormState): string | null => {
    if (!f.loanNumber.trim()) return 'Enter the Loan Number.'
    if (isOther) {
      if (!f.borrowerName.trim()) return 'Enter who this loan is for.'
      if (f.chargeInterest && rate <= 0)
        return 'Enter an interest rate, or turn off "Charge interest?".'
    } else {
      if (!f.employeeId) return 'Pick the employee.'
      if (term <= 0) return 'Enter the term in months.'
      if (!f.firstDeductionDate) return 'Enter the First Deduction Date.'
    }
    if (principal <= 0) return 'Enter the Loan Principal.'
    if (!f.bankAccountId) return 'Pick a Bank / Cash Account.'
    return null
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const validationError = validate(form)
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError(null)
    const shared = {
      loanNumber: form.loanNumber,
      principal,
      loanDate: form.loanDate,
      disbursementMethod: form.disbursementMethod,
      bankAccountId: form.bankAccountId,
      referenceNumber: form.referenceNumber || undefined,
      note: form.note || undefined,
    }
    const res = await updateEmployeeCashLoan(
      id,
      isOther
        ? {
            borrowerType: 'OTHER' as const,
            borrowerName: form.borrowerName.trim(),
            chargeInterest: form.chargeInterest,
            interestRate: form.chargeInterest ? rate : undefined,
            ...shared,
          }
        : {
            borrowerType: 'EMPLOYEE' as const,
            employeeId: form.employeeId,
            termMonths: term,
            interestRate: rate,
            firstDeductionDate: form.firstDeductionDate,
            ...shared,
          }
    )
    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Failed to save changes')
      return
    }
    queryClient.invalidateQueries({ queryKey: ['pos-employee-cash-loans'] })
    router.push(`/accounting/employee-cash-loans/${id}`)
  }

  if (loading) {
    return <div className="px-6 py-8 text-sm text-zinc-400 lg:px-10">Loading…</div>
  }
  if (notFound || !form) {
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

  return (
    <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/accounting/employee-cash-loans/${id}`}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Loan
        </Link>

        <h1 className="text-2xl font-bold text-prominent-purple-900 md:text-3xl">
          Edit Employee Cash Loan
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {hasPayments
            ? 'This loan already has payments recorded — Principal, Interest, and Loan Date can no longer be edited. Only the Loan Number, Reference/Voucher No., and Note can be changed.'
            : isOther
              ? 'Changing Principal, Interest, Loan Date, Disbursement Method, or Bank / Cash Account reverses the original journal entry and posts a new one.'
              : 'Changing Principal, Term, Interest Rate, Loan Date, First Deduction Date, Disbursement Method, or Bank / Cash Account reverses the original journal entry and posts a new one. Editing only the Reference/Voucher No. or Note doesn’t touch the GL.'}
        </p>

        <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <Field label="Loan Number *">
              <input
                value={form.loanNumber}
                onChange={(e) => setForm({ ...form, loanNumber: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>

            {isOther ? (
              <Field label="Name *">
                <input
                  value={form.borrowerName}
                  disabled={hasPayments}
                  onChange={(e) => setForm({ ...form, borrowerName: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
                />
              </Field>
            ) : (
              <Field label="Employee *">
                <EmployeeSearchCombobox
                  value={form.employeeId}
                  onChange={(employeeId) => setForm({ ...form, employeeId })}
                  initialLabel={form.employeeLabel}
                  error={undefined}
                />
              </Field>
            )}

            <div className={isOther ? undefined : 'grid grid-cols-2 gap-3'}>
              <Field label="Loan Principal *">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.principal}
                  disabled={hasPayments}
                  onChange={(e) => setForm({ ...form, principal: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
                />
              </Field>
              {!isOther && (
                <Field label="Term (months) *">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={form.termMonths}
                    disabled={hasPayments}
                    onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
                  />
                </Field>
              )}
            </div>

            {isOther ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={form.chargeInterest}
                    disabled={hasPayments}
                    onChange={(e) => setForm({ ...form, chargeInterest: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  Charge interest?
                </label>
                {form.chargeInterest && (
                  <Field label="Interest Rate (one-time) *">
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={form.interestRate}
                      disabled={hasPayments}
                      onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
                    />
                  </Field>
                )}
              </div>
            ) : (
              <Field label="Interest Rate / Loan Factor *">
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.interestRate}
                  disabled={hasPayments}
                  onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
                />
              </Field>
            )}

            <div className={isOther ? undefined : 'grid grid-cols-2 gap-3'}>
              <Field label="Loan Date *">
                <input
                  type="date"
                  value={form.loanDate}
                  disabled={hasPayments}
                  onChange={(e) => setForm({ ...form, loanDate: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
                />
              </Field>
              {!isOther && (
                <Field label="First Deduction Date *">
                  <input
                    type="date"
                    value={form.firstDeductionDate}
                    disabled={hasPayments}
                    onChange={(e) => setForm({ ...form, firstDeductionDate: e.target.value })}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
                  />
                </Field>
              )}
            </div>

            <Field label="Disbursement Method *">
              <select
                value={form.disbursementMethod}
                disabled={hasPayments}
                onChange={(e) =>
                  setForm({
                    ...form,
                    disbursementMethod: e.target.value as FormState['disbursementMethod'],
                  })
                }
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHECK">Check</option>
              </select>
            </Field>

            <Field label="Bank / Cash Account *">
              <CategorySelect
                aria-label="Select bank account"
                noun="bank accounts"
                value={form.bankAccountId}
                disabled={hasPayments}
                onChange={(id) => setForm({ ...form, bankAccountId: id ?? '' })}
                options={bankAccountOptions}
                placeholder="— Select —"
              />
            </Field>

            <Field label="Reference / Voucher No.">
              <input
                value={form.referenceNumber}
                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Note (optional)">
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
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
                className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div className="h-fit space-y-2 rounded-xl border border-gray-200 bg-prominent-purple-50/40 p-6">
            <h3 className="text-sm font-semibold text-zinc-700">Computed Financing Terms</h3>
            {isOther ? (
              otherPreview ? (
                <dl className="space-y-1.5 text-sm">
                  <Row label="Principal Amount" value={fmt(principal)} />
                  {form.chargeInterest && (
                    <Row label="Total Interest" value={fmt(otherPreview.totalInterest)} />
                  )}
                  <Row label="Total Amount Receivable" value={fmt(otherPreview.totalReceivable)} />
                </dl>
              ) : (
                <p className="text-sm text-zinc-400">
                  Enter a Loan Principal to preview the total.
                </p>
              )
            ) : employeePreview ? (
              <dl className="space-y-1.5 text-sm">
                <Row label="Principal Amount" value={fmt(principal)} />
                <Row label="Total Interest" value={fmt(employeePreview.totalInterest)} />
                <Row label="Total Amount Receivable" value={fmt(employeePreview.totalReceivable)} />
                <Row label="Term" value={`${term} months`} />
                <Row label="Monthly Principal" value={fmt(employeePreview.monthlyPrincipal)} />
                <Row label="Monthly Interest" value={fmt(employeePreview.monthlyInterest)} />
                <Row
                  label="Monthly Installment/Deduction"
                  value={fmt(employeePreview.monthlyDeduction)}
                />
                <Row
                  label="First Due Date"
                  value={firstDueDate ? firstDueDate.toLocaleDateString('en-PH') : '—'}
                />
                <Row
                  label="Final Due Date"
                  value={finalDueDate ? finalDueDate.toLocaleDateString('en-PH') : '—'}
                />
              </dl>
            ) : (
              <p className="text-sm text-zinc-400">
                Enter a Loan Principal and term to preview the computed terms.
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium text-prominent-purple-900">{value}</dd>
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
