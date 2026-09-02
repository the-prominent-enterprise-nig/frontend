'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BankAccounts, type BankAccount, fmtMoney } from '@/src/libs/data/AccountingV2Data'

// Scenario 42 — starts a reconciliation worksheet. Only the statement
// balance is typed in here; the system generates everything else (System
// Balance + the pending-items list) the moment this form saves. Full page,
// not a modal — same pattern as Fund Transfer, since the worksheet the
// accountant lands on next has too much on it for a dialog.
export default function NewReconciliationForm() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [form, setForm] = useState({
    bankAccountId: '',
    statementDate: new Date().toISOString().slice(0, 10),
    statementBalance: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    BankAccounts.list().then((res) => {
      if (res.success && res.data) setAccounts(res.data)
    })
  }, [])

  const account = accounts.find((a) => a.id === form.bankAccountId)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await BankAccounts.createReconciliation({
      bankAccountId: form.bankAccountId,
      statementDate: form.statementDate,
      statementBalance: Number(form.statementBalance),
      notes: form.notes || undefined,
    })
    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Failed to start reconciliation')
      return
    }
    router.push(`/accounting/bank-reconciliation/${res.data.id}`)
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/accounting/bank-reconciliation"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to bank reconciliation
      </Link>

      <h1 className="text-2xl font-semibold text-gray-900">New Reconciliation</h1>
      <p className="mt-1 text-sm text-gray-500">
        Enter the closing balance off the actual bank statement. Everything else — System Balance
        and the list of pending deposits/withdrawals — is generated for you on the next screen.
      </p>

      <form
        onSubmit={submit}
        className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-6"
      >
        <Field label="Bank Account *">
          <select
            required
            value={form.bankAccountId}
            onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            <option value="">— Select —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.accountType})
              </option>
            ))}
          </select>
          {account && (
            <p className="mt-1 text-[12px] text-gray-500">
              Current book balance: {fmtMoney(account.currentBalance)}
            </p>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Statement Date *">
            <input
              required
              type="date"
              value={form.statementDate}
              onChange={(e) => setForm({ ...form, statementDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
          <Field label="Statement Balance *">
            <input
              required
              type="number"
              step="0.01"
              value={form.statementBalance}
              onChange={(e) => setForm({ ...form, statementBalance: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </Field>

        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Link
            href="/accounting/bank-reconciliation"
            className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg text-gray-700"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Generating worksheet...' : 'Start Reconciliation'}
          </button>
        </div>
      </form>
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
