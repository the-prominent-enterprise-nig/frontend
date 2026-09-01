'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EmployeeApplianceLoans, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import EmployeePicker from '@/src/components/accounting/EmployeePicker'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Mirrors EmployeeApplianceLoansService.computeFinancing (backend) — a live
// preview only; the server recomputes and is the source of truth.
function computeFinancing(lcp: number, dp: number, term: number, miFactor: number) {
  const amountFinanced = round2(lcp - dp)
  const monthlyInstallment = round2(amountFinanced * miFactor)
  const pnv = round2(monthlyInstallment * term)
  const totalPrice = round2(pnv + dp)
  const interestDifferential = round2(totalPrice - lcp)
  const ppd = round2(monthlyInstallment * 0.075)
  return { amountFinanced, monthlyInstallment, pnv, totalPrice, interestDifferential, ppd }
}

export default function NewLoanForm() {
  const router = useRouter()
  const [form, setForm] = useState({
    employeeId: '',
    employeeLabel: '',
    itemDescription: '',
    listedCashPrice: '',
    downPayment: '',
    termMonths: '12',
    miFactor: '0.0954',
    startDate: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lcp = Number(form.listedCashPrice) || 0
  const dp = Number(form.downPayment) || 0
  const term = Number(form.termMonths) || 0
  const miFactor = Number(form.miFactor) || 0
  const preview = lcp > 0 && term > 0 ? computeFinancing(lcp, dp, term, miFactor) : null

  const validate = (): string | null => {
    if (!form.employeeId) return 'Pick the employee.'
    if (!form.itemDescription.trim()) return 'Describe the appliance.'
    if (lcp <= 0) return 'Enter the Listed Cash Price.'
    if (dp > lcp) return 'Down Payment cannot exceed the Listed Cash Price.'
    if (term <= 0) return 'Enter the term in months.'
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
    const res = await EmployeeApplianceLoans.create({
      employeeId: form.employeeId,
      itemDescription: form.itemDescription,
      listedCashPrice: lcp,
      downPayment: dp,
      termMonths: term,
      miFactor,
      startDate: form.startDate,
    })
    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Failed to create loan')
      return
    }
    router.push(`/accounting/employee-appliance-loans/${res.data.id}`)
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/accounting/employee-appliance-loans"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to employee appliance loans
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900">New Employee Appliance Loan</h1>
      <p className="mt-1 text-sm text-gray-500">
        Computes the financing terms (same formula as customer installment plans) and posts the
        disbursement to the GL.
      </p>

      <form onSubmit={submit} className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-6">
          <div className="max-w-md">
            <Field label="Employee *">
              <EmployeePicker
                value={form.employeeId}
                selectedLabel={form.employeeLabel}
                onChange={(employeeId, label) =>
                  setForm({ ...form, employeeId, employeeLabel: label })
                }
              />
            </Field>
          </div>

          <Field label="Item / Appliance *">
            <input
              value={form.itemDescription}
              onChange={(e) => setForm({ ...form, itemDescription: e.target.value })}
              placeholder='e.g. Samsung 55" Smart TV'
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Listed Cash Price *">
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={form.listedCashPrice}
                onChange={(e) => setForm({ ...form, listedCashPrice: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="Down Payment">
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.downPayment}
                onChange={(e) => setForm({ ...form, downPayment: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Term (months) *">
              <input
                required
                type="number"
                step="1"
                min="1"
                value={form.termMonths}
                onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
            <Field label="MI Factor *">
              <input
                required
                type="number"
                step="0.0001"
                min="0"
                value={form.miFactor}
                onChange={(e) => setForm({ ...form, miFactor: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
          </div>

          <div className="max-w-xs">
            <Field label="Start Date *">
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </Field>
          </div>

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Link
              href="/accounting/employee-appliance-loans"
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg text-gray-700"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Loan'}
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-gray-200 bg-purple-50/40 p-6 h-fit">
          <h3 className="text-sm font-semibold text-gray-700">Computed Financing Terms</h3>
          {preview ? (
            <dl className="space-y-1.5 text-sm">
              <Row label="Amount Financed (AF)" value={preview.amountFinanced} />
              <Row label="Monthly Installment (MI)" value={preview.monthlyInstallment} />
              <Row label="PNV (MI × Term)" value={preview.pnv} />
              <Row label="Total Price" value={preview.totalPrice} />
              <Row label="Interest Differential" value={preview.interestDifferential} />
              <Row label="PPD (7.5% of MI)" value={preview.ppd} />
            </dl>
          ) : (
            <p className="text-sm text-gray-400">
              Enter a Listed Cash Price and term to preview the computed terms.
            </p>
          )}
        </div>
      </form>
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{fmtMoney(value)}</dd>
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
