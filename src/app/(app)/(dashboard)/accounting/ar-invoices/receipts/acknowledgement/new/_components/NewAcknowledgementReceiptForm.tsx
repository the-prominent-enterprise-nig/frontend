'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  AcknowledgementReceipts,
  BankAccounts,
  type BankAccount,
  type PaymentMethod,
  PAYMENT_METHOD_OPTIONS,
} from '@/src/libs/data/AccountingV2Data'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

/** Scenario 57 — a real, dedicated "New Acknowledgement Receipt" page (not a
 * modal), same posture as Collection Receipt's own New Receipt page. Payer
 * is free text by developer decision — no search/link to an existing
 * Customer/Supplier/Employee record, closer to a digitized paper receipt
 * book than a linked transaction. */
export default function NewAcknowledgementReceiptForm() {
  const router = useRouter()

  const [form, setForm] = useState({
    payerName: '',
    reason: '',
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    method: 'CASH' as PaymentMethod,
    reference: '',
    notes: '',
    bankAccountId: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  useEffect(() => {
    BankAccounts.list().then((res) => setBankAccounts(res.data ?? []))
  }, [])

  const requiresBankAccount = form.method !== 'CASH'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (requiresBankAccount && !form.bankAccountId) {
      setError(`Source of Fund is required for ${form.method.replace('_', ' ')} payments.`)
      return
    }
    setSaving(true)
    setError(null)
    const res = await AcknowledgementReceipts.create({
      ...form,
      amount: Number(form.amount),
      reason: form.reason || undefined,
      reference: form.reference || undefined,
      notes: form.notes || undefined,
      bankAccountId: form.bankAccountId || undefined,
    })
    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Save failed')
      return
    }
    router.push(`/accounting/ar-invoices/receipts/acknowledgement/view?id=${res.data.id}`)
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/accounting/ar-invoices"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to AR Invoices
      </Link>

      <h1 className="text-2xl font-semibold text-prominent-purple-900">
        New Acknowledgement Receipt
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Record money received with no customer or invoice behind it — a walk-in payment, a refund,
        or anything else that isn&apos;t a Collection Receipt.
      </p>

      <form
        onSubmit={submit}
        className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-5"
      >
        <Field label="Who Paid *">
          <input
            required
            autoFocus
            placeholder="Payer name"
            value={form.payerName}
            onChange={(e) => setForm({ ...form, payerName: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
          />
        </Field>
        <Field label="Reason">
          <input
            placeholder="What the money is for"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount Received *">
            <input
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Payment Date *">
            <input
              required
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Method">
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={requiresBankAccount ? 'Source of Fund *' : 'Source of Fund'}>
            <select
              required={requiresBankAccount}
              value={form.bankAccountId}
              onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">{requiresBankAccount ? '— Select —' : '— Not tracked —'}</option>
              {bankAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — {acc.bankName} ({acc.accountNumber})
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Reference">
          <input
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Notes">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </Field>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Record Receipt'}
          </button>
        </div>
      </form>
    </div>
  )
}
