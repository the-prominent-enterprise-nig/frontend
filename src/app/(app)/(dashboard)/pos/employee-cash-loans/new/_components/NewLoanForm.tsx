'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import CategorySelect from '@/src/components/ui/CategorySelect'
import EmployeeSearchCombobox from '../../_components/EmployeeSearchCombobox'
import { issueEmployeeCashLoan } from '../../_actions/issue-cash-loan'
import {
  listEmployeeCashLoanBankAccounts,
  type EmployeeCashLoanBankAccount,
} from '../../_actions/list-bank-accounts'

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
// interestRate is a flat MONTHLY add-on rate — interest accrues across the
// whole term, not a one-time charge.
function computeFinancing(principal: number, termMonths: number, interestRate: number) {
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

export default function NewLoanForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    employeeId: '',
    employeeLabel: '',
    principal: '',
    termMonths: '12',
    // Scenario 56 — default monthly add-on rate is 3%, still editable.
    interestRate: '0.03',
    loanDate: new Date().toISOString().slice(0, 10),
    firstDeductionDate: '',
    disbursementMethod: 'CASH' as 'CASH' | 'BANK_TRANSFER' | 'CHECK',
    bankAccountId: '',
    referenceNumber: '',
    note: '',
  })
  const [bankAccounts, setBankAccounts] = useState<EmployeeCashLoanBankAccount[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listEmployeeCashLoanBankAccounts().then((res) => {
      if (res.success && res.data) setBankAccounts(res.data)
    })
  }, [])

  const principal = Number(form.principal) || 0
  const term = Number(form.termMonths) || 0
  const rate = Number(form.interestRate) || 0
  const preview = principal > 0 && term > 0 ? computeFinancing(principal, term, rate) : null
  const firstDueDate = form.firstDeductionDate ? new Date(form.firstDeductionDate) : null
  const finalDueDate = term > 0 ? addCalendarMonths(form.firstDeductionDate, term - 1) : null

  const bankAccountOptions = bankAccounts.map((a) => ({
    id: a.id,
    name:
      a.name === a.bankName
        ? `${a.name} (${a.accountNumber})`
        : `${a.name} — ${a.bankName} (${a.accountNumber})`,
    depth: 0,
  }))

  const validate = (): string | null => {
    if (!form.employeeId) return 'Pick the employee.'
    if (principal <= 0) return 'Enter the Loan Principal.'
    if (term <= 0) return 'Enter the term in months.'
    if (!form.firstDeductionDate) return 'Enter the First Deduction Date.'
    if (!form.bankAccountId) return 'Pick a Bank / Cash Account.'
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
    const res = await issueEmployeeCashLoan({
      employeeId: form.employeeId,
      principal,
      termMonths: term,
      interestRate: rate,
      loanDate: form.loanDate,
      firstDeductionDate: form.firstDeductionDate,
      disbursementMethod: form.disbursementMethod,
      bankAccountId: form.bankAccountId,
      referenceNumber: form.referenceNumber || undefined,
      note: form.note || undefined,
    })
    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Failed to create loan')
      return
    }
    // The list page's own useQuery cache (a different page/mount, so
    // revalidatePath in the server action doesn't reach it) would otherwise
    // still show its pre-issuance snapshot for up to staleTime on return.
    queryClient.invalidateQueries({ queryKey: ['pos-employee-cash-loans'] })
    router.push(`/pos/employee-cash-loans/${res.data.id}`)
  }

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

        <h1 className="text-2xl font-bold text-prominent-purple-900 md:text-3xl">
          New Employee Cash Loan
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          No approval step — posts immediately. Repayment isn&apos;t automatic yet; it&apos;s
          recovered later via payroll/Accounting.
        </p>

        <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <Field label="Employee *">
              <EmployeeSearchCombobox
                value={form.employeeId}
                onChange={(employeeId) => setForm({ ...form, employeeId })}
                error={undefined}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Loan Principal *">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.principal}
                  onChange={(e) => setForm({ ...form, principal: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Term (months) *">
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={form.termMonths}
                  onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <Field label="Interest Rate / Loan Factor *">
              <input
                type="number"
                step="0.0001"
                min="0"
                value={form.interestRate}
                onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Loan Date *">
                <input
                  type="date"
                  value={form.loanDate}
                  onChange={(e) => setForm({ ...form, loanDate: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="First Deduction Date *">
                <input
                  type="date"
                  value={form.firstDeductionDate}
                  onChange={(e) => setForm({ ...form, firstDeductionDate: e.target.value })}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <Field label="Disbursement Method *">
              <select
                value={form.disbursementMethod}
                onChange={(e) =>
                  setForm({
                    ...form,
                    disbursementMethod: e.target.value as typeof form.disbursementMethod,
                  })
                }
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
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
                onChange={(id) => setForm({ ...form, bankAccountId: id ?? '' })}
                options={bankAccountOptions}
                placeholder="— Select —"
              />
            </Field>

            <Field label="Reference / Voucher No.">
              <input
                value={form.referenceNumber}
                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                placeholder="Auto-generated if left blank"
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
                href="/pos/employee-cash-loans"
                className="rounded-lg px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800 disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create Cash Loan'}
              </button>
            </div>
          </div>

          <div className="h-fit space-y-2 rounded-xl border border-gray-200 bg-prominent-purple-50/40 p-6">
            <h3 className="text-sm font-semibold text-zinc-700">Computed Financing Terms</h3>
            {preview ? (
              <dl className="space-y-1.5 text-sm">
                <Row label="Principal Amount" value={fmt(principal)} />
                <Row label="Total Interest" value={fmt(preview.totalInterest)} />
                <Row label="Total Amount Receivable" value={fmt(preview.totalReceivable)} />
                <Row label="Term" value={`${term} months`} />
                <Row label="Monthly Principal" value={fmt(preview.monthlyPrincipal)} />
                <Row label="Monthly Interest" value={fmt(preview.monthlyInterest)} />
                <Row label="Monthly Installment/Deduction" value={fmt(preview.monthlyDeduction)} />
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
      <dd className="font-medium text-zinc-900">{value}</dd>
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
