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
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-prominent-purple-900">
        {label}
      </p>
      {children}
    </div>
  )
}

// Accounts come back flat (with a parentId) ordered by account number — turn
// that into the depth-ordered list CategorySelect needs, same helper
// ExpenseForm.tsx uses for its own account picker.
function accountsToCategoryOptions(accounts: Account[]): CategorySelectOption[] {
  const idsInList = new Set(accounts.map((a) => a.id))
  const childrenByParent = new Map<string, Account[]>()
  const roots: Account[] = []
  for (const a of accounts) {
    if (a.parentId && idsInList.has(a.parentId)) {
      const siblings = childrenByParent.get(a.parentId) ?? []
      siblings.push(a)
      childrenByParent.set(a.parentId, siblings)
    } else {
      roots.push(a)
    }
  }
  const options: CategorySelectOption[] = []
  const walk = (list: Account[], depth: number) => {
    for (const a of list) {
      options.push({ id: a.id, name: a.number ? `${a.number} — ${a.name}` : a.name, depth })
      const children = childrenByParent.get(a.id)
      if (children) walk(children, depth + 1)
    }
  }
  walk(roots, 0)
  return options
}

/** Scenario 57 — a real, dedicated "New Acknowledgement Receipt" page (not a
 * modal), reached from POS Collections (developer correction, 2026-09-21 —
 * moved off Accounting's AR Invoices page, since this is a Collections
 * action per the client's own notes, not a back-office bookkeeping one).
 * Layout follows the client's own reference receipt tool (Date/Reference,
 * Paid by, Received in, Account, Description) rather than this app's usual
 * two-column Field grid — developer-requested, 2026-09-21. "Received in" is
 * the tenant's own bank/cash accounts (which physical drawer/account the
 * money landed in, informational only — same posture as CollectionReceipt's
 * own bankAccountId); "Account" further down is a separate Chart-of-Accounts
 * pick that actually drives which account the receipt credits. Payer is
 * free text by developer decision — no search/link to an existing
 * Customer/Supplier/Employee record, closer to a digitized paper receipt
 * book than a linked transaction. */
export default function NewAcknowledgementReceiptForm() {
  const router = useRouter()

  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    reference: '',
    payerName: '',
    bankAccountId: '',
    accountId: '',
    reason: '',
    amount: '',
    method: 'CASH' as PaymentMethod,
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [accountOptions, setAccountOptions] = useState<CategorySelectOption[]>([])
  useEffect(() => {
    BankAccounts.list().then((res) => setBankAccounts(res.data ?? []))
    getAccounts({ limit: 500 }).then((res) => {
      const list = ((res.data as any)?.items ?? res.data ?? []) as Account[]
      setAccountOptions(accountsToCategoryOptions(list))
    })
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await AcknowledgementReceipts.create({
      ...form,
      amount: Number(form.amount),
      bankAccountId: form.bankAccountId || undefined,
      accountId: form.accountId || undefined,
      reason: form.reason || undefined,
      reference: form.reference || undefined,
      notes: form.notes || undefined,
    })
    setSaving(false)
    if (!res.success || !res.data) {
      setError(res.message || res.error || 'Save failed')
      return
    }
    router.push(`/pos/collections/acknowledgement/view?id=${res.data.id}`)
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/pos/collections"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Collections
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
        className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-5"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date *">
            <input
              required
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm({ ...form, paymentDate: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Reference">
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="Optional"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Section label="Paid by">
          <input
            required
            autoFocus
            placeholder="Payer name"
            value={form.payerName}
            onChange={(e) => setForm({ ...form, payerName: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
          />
        </Section>

        <Section label="Received in">
          <CategorySelect
            value={form.bankAccountId || undefined}
            onChange={(id) => setForm({ ...form, bankAccountId: id ?? '' })}
            options={bankAccounts.map((acc) => ({
              id: acc.id,
              name: `${acc.name} — ${acc.bankName} (${acc.accountNumber})`,
              depth: 0,
            }))}
            placeholder="— Not tracked —"
            noun="bank accounts"
          />
        </Section>

        <Field label="Account">
          <CategorySelect
            value={form.accountId || undefined}
            onChange={(value) => setForm({ ...form, accountId: value ?? '' })}
            options={accountOptions}
            placeholder="Select account…"
            noun="accounts"
          />
        </Field>

        <Field label="Description">
          <input
            placeholder="Optional"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount *">
            <input
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>
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
        </div>

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
