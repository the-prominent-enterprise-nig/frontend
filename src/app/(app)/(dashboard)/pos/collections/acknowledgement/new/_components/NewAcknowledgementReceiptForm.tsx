'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  AcknowledgementReceipts,
  BankAccounts,
  fmtMoney,
  type BankAccountOption,
} from '@/src/libs/data/AccountingV2Data'
import { getAccountOptions, type Account } from '@/src/libs/data/AccountingData'
import CategorySelect, { type CategorySelectOption } from '@/src/components/ui/CategorySelect'
import SegmentedControl from '@/src/components/ui/SegmentedControl'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { useBranches } from '@/src/app/(app)/(dashboard)/pos/_hooks/usePos'
import CustomerField, { type PickedCustomer } from './CustomerField'
import InvoiceField, { type PickedInvoice } from './InvoiceField'
import {
  CLEARED_OPTIONS,
  buildJournalPreview,
  clearDateError,
  computeSettlementNet,
  todayLocalIso,
  toAmount,
  type ClearedType,
} from '../_lib/settlement'

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-800">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  )
}

const RECEIPT_TYPE_OPTIONS = [
  { value: 'ACKNOWLEDGEMENT', label: 'Acknowledgement' },
  { value: 'COLLECTION', label: 'Collection' },
]

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
 * Customer, Received in, Description) rather than this app's usual
 * two-column Field grid — developer-requested, 2026-09-21. "Received in" is
 * the tenant's own bank/cash accounts. Picking one means the money landed in
 * the bank itself, so the receipt debits Cash in Bank and is never offered to
 * a branch deposit; empty, a branch receipt is counter cash to be banked.
 *
 * Settlement (client's proposed receipts template): the receipt carries the
 * customer and sales invoice it is for (the invoice is a reference only —
 * nothing is created and no invoice balance moves), the Gross AR amount, the
 * Subsidy taken out of it and the Withholding Tax added to the Net (a credit
 * to a payable) — each with its own selectable account — and the Net that
 * reached the bank, calculated here. */
export default function NewAcknowledgementReceiptForm({
  restrictedBranchId,
  acknowledgementOnly = false,
}: {
  /** A branch-assigned caller's own branch — the service stores this
   * server-side regardless of what's submitted, so the form locks to it
   * instead of offering a picker that would just get overridden. Null for a
   * non-branch-assigned caller (e.g. Business Owner), who picks one below.
   * Same idiom as financing-terms' own restrictedBranchId. */
  restrictedBranchId: string | null
  /** The caller may record acknowledgment receipts only (Treasury Clerk,
   * Access Levels Part 2): the type picker offers just that one. */
  acknowledgementOnly?: boolean
}) {
  const router = useRouter()
  const { data: branchesData, isLoading: branchesLoading } = useBranches()
  const branches = (branchesData?.data ?? []) as Array<{ id: string; name: string }>
  const restrictedBranchName = restrictedBranchId
    ? (branches.find((b) => b.id === restrictedBranchId)?.name ?? 'your branch')
    : null

  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    reference: '',
    bankAccountId: '',
    receivedInAccountId: '',
    reason: '',
    receiptType: 'ACKNOWLEDGEMENT' as 'COLLECTION' | 'ACKNOWLEDGEMENT',
    clearedType: 'SAME_DATE' as ClearedType,
    clearedDate: '',
    branchId: restrictedBranchId ?? '',
    gross: '',
    subsidy: '',
    subsidyAccountId: '',
    withholding: '',
    withholdingAccountId: '',
  })
  const [customer, setCustomer] = useState<PickedCustomer | null>(null)
  const [invoice, setInvoice] = useState<PickedInvoice | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])
  const [accountOptions, setAccountOptions] = useState<CategorySelectOption[]>([])
  useEffect(() => {
    BankAccounts.options().then((res) => setBankAccounts(res.data ?? []))
    getAccountOptions().then((res) => {
      const list = ((res.data as any)?.items ?? res.data ?? []) as Account[]
      setAccountOptions(accountsToCategoryOptions(list))
    })
  }, [])

  const gross = toAmount(form.gross)
  const subsidy = toAmount(form.subsidy)
  const withholding = toAmount(form.withholding)
  const net = computeSettlementNet(gross, subsidy, withholding)
  const netInvalid = gross > 0 && net <= 0
  const today = todayLocalIso()
  const clearErr = clearDateError(form.clearedType, form.clearedDate, today)

  const accountLabel = useMemo(() => {
    const byId = new Map(accountOptions.map((o) => [o.id, o.name]))
    return (id: string) => (id ? (byId.get(id) ?? null) : null)
  }, [accountOptions])
  const journalLines = buildJournalPreview({
    net,
    subsidy,
    withholding,
    gross,
    // A "Received in" bank means the money went straight to the bank. Without
    // one, a branch's receipt sits in Cash on Hand — Branch Collections until
    // it is banked, and head office's goes straight to the bank.
    cashLabel:
      accountLabel(form.receivedInAccountId) ??
      ((restrictedBranchId ?? form.branchId) && !form.bankAccountId
        ? 'Cash on Hand — Branch Collections'
        : 'Cash in Bank'),
    subsidyAccountLabel: accountLabel(form.subsidyAccountId),
    withholdingAccountLabel: accountLabel(form.withholdingAccountId),
    // With a customer the gross credits Accounts Receivable, which is what puts
    // it on their ledger and in AR Aging.
    creditAccountLabel: customer ? 'Accounts Receivable (customer ledger)' : null,
  })

  const changeCustomer = (next: PickedCustomer | null) => {
    // An invoice picked from the search belongs to the customer it was found
    // under; a typed number is just text and stays.
    if (invoice?.id && next?.id !== customer?.id) setInvoice(null)
    setCustomer(next)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!customer) {
      setError('Pick a customer, or add a new one.')
      return
    }
    if (!(gross > 0)) {
      setError('Gross must be greater than 0.')
      return
    }
    if (subsidy < 0 || withholding < 0) {
      setError('Subsidy and Withholding Tax cannot be negative.')
      return
    }
    if (net <= 0) {
      setError(
        'Net amount must be greater than 0 — Subsidy cannot reach Gross plus Withholding Tax.'
      )
      return
    }
    if (withholding > 0 && !form.withholdingAccountId) {
      setError('Pick the Withholding Tax account the tax is credited to.')
      return
    }
    if (clearErr) {
      setError(clearErr)
      return
    }
    setSaving(true)
    const res = await AcknowledgementReceipts.create({
      receiptType: form.receiptType,
      branchId: restrictedBranchId ?? (form.branchId || undefined),
      paymentDate: form.paymentDate,
      reference: form.reference || undefined,
      payerName: customer.name,
      customerId: customer.id,
      invoiceNo: invoice?.number || undefined,
      arInvoiceId: invoice?.id || undefined,
      bankAccountId: form.bankAccountId || undefined,
      receivedInAccountId: form.receivedInAccountId || undefined,
      reason: form.reason || undefined,
      clearedType: form.clearedType,
      clearedDate: form.clearedType === 'SAME_DATE' ? undefined : form.clearedDate || undefined,
      grossAmount: gross,
      subsidyAmount: subsidy,
      subsidyAccountId: subsidy > 0 ? form.subsidyAccountId || undefined : undefined,
      withholdingAmount: withholding,
      withholdingAccountId: withholding > 0 ? form.withholdingAccountId || undefined : undefined,
      amount: net,
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
        New {form.receiptType === 'COLLECTION' ? 'Collection' : 'Acknowledgement'} Receipt
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Record money received for a customer&apos;s sale — gross, less any subsidy, plus any
        withholding tax, with the net that reached the bank. Receipts from earlier dates can be
        recorded too.
      </p>

      <form
        onSubmit={submit}
        className="mt-6 space-y-4 rounded-xl border border-gray-200 bg-white p-5"
      >
        <Field label="Receipt Type" required>
          <SearchableSelect
            value={form.receiptType}
            onChange={(value) =>
              setForm({ ...form, receiptType: value as 'COLLECTION' | 'ACKNOWLEDGEMENT' })
            }
            options={
              acknowledgementOnly
                ? RECEIPT_TYPE_OPTIONS.filter((o) => o.value === 'ACKNOWLEDGEMENT')
                : RECEIPT_TYPE_OPTIONS
            }
            placeholder="Select receipt type…"
          />
        </Field>

        <Field label="Branch">
          {restrictedBranchId ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {restrictedBranchName}
            </p>
          ) : (
            <SearchableSelect
              value={form.branchId}
              onChange={(value) => setForm({ ...form, branchId: value })}
              options={branches.map((b) => ({ value: b.id, label: b.name }))}
              placeholder={branchesLoading ? 'Loading branches…' : '— Not tracked —'}
              disabled={branchesLoading}
              clearable
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cleared">
            <SegmentedControl
              name="Cleared"
              value={form.clearedType}
              onChange={(value) =>
                setForm({
                  ...form,
                  clearedType: value,
                  clearedDate: value === 'SAME_DATE' ? '' : form.clearedDate,
                })
              }
              options={CLEARED_OPTIONS}
            />
          </Field>
          <Field
            label="Clear Date"
            required={form.clearedType === 'PAST_DATE'}
            hint={
              form.clearedType === 'PAST_DATE'
                ? 'The date it already cleared — on or before today.'
                : undefined
            }
          >
            <input
              type="date"
              disabled={form.clearedType === 'SAME_DATE'}
              required={form.clearedType === 'PAST_DATE'}
              max={form.clearedType === 'PAST_DATE' ? today : undefined}
              value={form.clearedDate}
              onChange={(e) => setForm({ ...form, clearedDate: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
            />
            {form.clearedType === 'PAST_DATE' && form.clearedDate && clearErr && (
              <span className="mt-1 block text-xs text-red-600">{clearErr}</span>
            )}
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-800">
              Customer <span className="text-red-600">*</span>
            </span>
            <CustomerField value={customer} onChange={changeCustomer} />
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-800">Sales Invoice No.</span>
            <InvoiceField customer={customer} value={invoice} onChange={setInvoice} />
          </div>
        </div>

        <Field
          label="Received in"
          hint="Pick the bank it landed in and the receipt goes straight to Cash in Bank, with no deposit to make. Leave it empty for cash taken over the counter."
        >
          <SearchableSelect
            value={form.bankAccountId}
            onChange={(value) => setForm({ ...form, bankAccountId: value })}
            options={bankAccounts.map((acc) => ({
              value: acc.id,
              label: `${acc.name} — ${acc.bankName} (${acc.accountNumber})`,
            }))}
            placeholder="— Not tracked —"
            clearable
          />
        </Field>

        <Field
          label="Received in account"
          hint="The account the money was received in (debited). Left empty, it is Cash in Bank, or Cash on Hand for a branch receipt."
        >
          <CategorySelect
            value={form.receivedInAccountId || undefined}
            onChange={(value) => setForm({ ...form, receivedInAccountId: value ?? '' })}
            options={accountOptions}
            placeholder="Default: Cash in Bank"
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

        <h2 className="border-t border-gray-100 pt-4 text-sm font-semibold text-prominent-purple-900">
          Settlement
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Gross (AR amount)"
            required
            hint={
              customer
                ? "Credited to Accounts Receivable, so it shows on the customer's ledger and in AR Aging."
                : "Held in Other / Miscellaneous Collections until it is applied to the customer's invoice."
            }
          >
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={form.gross}
              onChange={(e) => setForm({ ...form, gross: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Subsidy (debit)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.subsidy}
              onChange={(e) => setForm({ ...form, subsidy: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Subsidy account">
            <CategorySelect
              value={form.subsidyAccountId || undefined}
              onChange={(value) => setForm({ ...form, subsidyAccountId: value ?? '' })}
              options={accountOptions}
              placeholder="Default: Sales Discounts and Rebates"
              noun="accounts"
              disabled={!(subsidy > 0)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Withholding Tax (credit)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.withholding}
              onChange={(e) => setForm({ ...form, withholding: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Withholding Tax account" required={withholding > 0}>
            <CategorySelect
              value={form.withholdingAccountId || undefined}
              onChange={(value) => setForm({ ...form, withholdingAccountId: value ?? '' })}
              options={accountOptions}
              placeholder="Pick the account it is credited to"
              noun="accounts"
              disabled={!(withholding > 0)}
            />
          </Field>
        </div>

        <Field
          label="Net amount (credited to bank)"
          hint="Calculated: Gross − Subsidy + Withholding Tax."
        >
          <input
            readOnly
            tabIndex={-1}
            value={gross > 0 ? net.toFixed(2) : ''}
            placeholder="0.00"
            className="w-full cursor-default rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
          />
          {netInvalid && (
            <span className="mt-1 block text-xs text-red-600">
              Net must be greater than 0 — Subsidy cannot reach Gross plus Withholding Tax.
            </span>
          )}
        </Field>

        <div className="border-t border-gray-100 pt-4">
          <h2 className="text-sm font-semibold text-prominent-purple-900">Journal entry preview</h2>
          {journalLines.length === 0 ? (
            <p className="mt-2 text-sm text-gray-400">Enter the Gross amount to see the entry.</p>
          ) : (
            <div className="mt-2 space-y-1 text-sm text-gray-800">
              {journalLines.map((line, i) => (
                <div
                  key={`${line.side}-${i}`}
                  className={`flex justify-between gap-4 ${line.side === 'Cr' ? 'pl-8' : ''}`}
                >
                  <span>
                    <span className="inline-block w-7 font-medium text-gray-500">{line.side}</span>
                    {line.label}
                  </span>
                  <span className="tabular-nums">{fmtMoney(line.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

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
