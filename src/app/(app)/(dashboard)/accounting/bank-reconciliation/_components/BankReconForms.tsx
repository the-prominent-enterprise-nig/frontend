'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, Printer } from 'lucide-react'
import {
  BankAdjusting,
  ClearingSettlements,
  JournalVouchers,
  UnidentifiedBankCredits,
  type BankAccount,
  type ClearingSettlementType,
  type UnidentifiedBankCredit,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'
import { printJournalVoucherDocument } from '@/src/libs/print/printInventoryDocument'

// The Bank Reconciliation screen's side forms — Adjusting Entry, Unidentified
// Credit, Reclassify. Full pages, not modals (client
// UI/UX direction, 2026-09-30 — same rule that already moved the Expense and
// Fund Transfer forms off modals). Each has its own route under
// /accounting/bank-reconciliation/…; Cancel and Done go back to the list.

export const BANK_RECON_HREF = '/accounting/bank-reconciliation'

export const CLEARING_TYPE_LABELS: Record<ClearingSettlementType, string> = {
  card: 'Card',
  ewallet: 'E-Wallet',
  bank_transfer: 'Bank Transfer',
  tpf: 'TPF Partner',
}

function FormPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href={BANK_RECON_HREF}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to bank reconciliation
      </Link>
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      <div className="mt-6 max-w-2xl rounded-xl border border-gray-200 bg-white">{children}</div>
    </div>
  )
}

// Scenario 61 Part C — every bank adjusting entry and unidentified bank
// credit prints as a voucher carrying its Voucher Control No.
export async function printVoucher(journalEntryId: string, title: string) {
  const res = await JournalVouchers.getDocument(journalEntryId)
  if (res.success && res.data) printJournalVoucherDocument(res.data, title)
}

function VoucherControlNoField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">Voucher Control No. *</span>
      <input
        required
        maxLength={100}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
      />
    </label>
  )
}

/** Shown in place of a form once it has posted: the voucher, ready to print. */
function PostedVoucherPanel({
  journalEntryId,
  title,
  onDone,
}: {
  journalEntryId: string
  title: string
  onDone: () => void
}) {
  const [printing, setPrinting] = useState(false)
  return (
    <div className="p-5 space-y-4">
      <p className="flex items-center gap-2 text-sm text-emerald-700">
        <CheckCircle className="w-5 h-5" /> Posted to the General Ledger.
      </p>
      <div className="flex justify-end gap-2 pt-3 border-t">
        <button onClick={onDone} className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg">
          Done
        </button>
        <button
          onClick={async () => {
            setPrinting(true)
            await printVoucher(journalEntryId, title)
            setPrinting(false)
          }}
          disabled={printing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
        >
          <Printer className="w-4 h-4" /> {printing ? 'Preparing...' : 'Print Voucher'}
        </button>
      </div>
    </div>
  )
}

export function AdjustingForm({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: BankAccount[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    bankAccountId: '',
    type: 'BANK_CHARGE' as 'BANK_CHARGE' | 'INTEREST_INCOME',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
    voucherControlNo: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [postedJeId, setPostedJeId] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await BankAdjusting.create({
      ...form,
      amount: Number(form.amount),
      voucherControlNo: form.voucherControlNo.trim(),
    })
    setSaving(false)
    if (!res.success || !res.data?.id) {
      setError(res.message || res.error || 'Failed — check Account Mapping settings')
      return
    }
    setPostedJeId(res.data.id)
  }
  return (
    <FormPage title="Adjusting Entry">
      {postedJeId ? (
        <PostedVoucherPanel
          journalEntryId={postedJeId}
          title="Adjusting Entry Voucher"
          onDone={onSaved}
        />
      ) : (
        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            Records bank charges or interest income. Auto-posts to the General Ledger.
          </p>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Bank Account *</span>
            <select
              required
              value={form.bankAccountId}
              onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— Select —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Type *</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as any })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="BANK_CHARGE">Bank Charge</option>
              <option value="INTEREST_INCOME">Interest Income</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Amount *</span>
            <input
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Date *</span>
            <input
              required
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Description</span>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <VoucherControlNoField
            value={form.voucherControlNo}
            onChange={(v) => setForm({ ...form, voucherControlNo: v })}
          />
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Posting...' : 'Post to GL'}
            </button>
          </div>
        </form>
      )}
    </FormPage>
  )
}

export function UnidentifiedCreditForm({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: BankAccount[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    bankAccountId: '',
    amount: '',
    creditDate: new Date().toISOString().slice(0, 10),
    bankRef: '',
    voucherControlNo: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [postedJeId, setPostedJeId] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await UnidentifiedBankCredits.record({
      bankAccountId: form.bankAccountId,
      amount: Number(form.amount),
      creditDate: form.creditDate,
      bankRef: form.bankRef || undefined,
      voucherControlNo: form.voucherControlNo.trim(),
    })
    setSaving(false)
    if (!res.success || !res.data?.journalEntryId) {
      setError(res.message || res.error || 'Failed — check Account Mapping settings')
      return
    }
    setPostedJeId(res.data.journalEntryId)
  }
  return (
    <FormPage title="Record Unidentified Bank Credit">
      {postedJeId ? (
        <PostedVoucherPanel
          journalEntryId={postedJeId}
          title="Unidentified Bank Credit Voucher"
          onDone={onSaved}
        />
      ) : (
        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            An unexplained credit on the bank statement, no matching sale or settlement yet.
            Reclassify it once identified.
          </p>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Bank Account *</span>
            <select
              required
              value={form.bankAccountId}
              onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— Select —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Amount *</span>
            <input
              required
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Credit Date *</span>
            <input
              required
              type="date"
              value={form.creditDate}
              onChange={(e) => setForm({ ...form, creditDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">
              Bank Statement Reference
            </span>
            <input
              value={form.bankRef}
              onChange={(e) => setForm({ ...form, bankRef: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <VoucherControlNoField
            value={form.voucherControlNo}
            onChange={(v) => setForm({ ...form, voucherControlNo: v })}
          />
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Posting...' : 'Post to GL'}
            </button>
          </div>
        </form>
      )}
    </FormPage>
  )
}

export function ReclassifyForm({
  credit,
  onClose,
  onSaved,
}: {
  credit: UnidentifiedBankCredit
  onClose: () => void
  onSaved: () => void
}) {
  const [targetType, setTargetType] = useState<ClearingSettlementType>('card')
  const [tpfProviderId, setTpfProviderId] = useState('')
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (targetType === 'tpf' && providers.length === 0) {
      ClearingSettlements.activeTpfProviders().then((r) => setProviders(r.data ?? []))
    }
  }, [targetType, providers.length])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await UnidentifiedBankCredits.reclassify(credit.id, {
      targetType,
      tpfProviderId: targetType === 'tpf' ? tpfProviderId : undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to reclassify')
      return
    }
    onSaved()
  }

  return (
    <FormPage title="Reclassify Credit">
      <form onSubmit={submit} className="p-5 space-y-3">
        <p className="text-xs text-gray-500">
          {fmtMoney(credit.amount)} unidentified credit at {credit.bankAccount?.name} on{' '}
          {fmtDate(credit.creditDate)}. Now identified as:
        </p>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Identified As *</span>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as ClearingSettlementType)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
          >
            {Object.entries(CLEARING_TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {targetType === 'tpf' && (
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">TPF Partner *</span>
            <select
              required
              value={tpfProviderId}
              onChange={(e) => setTpfProviderId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— Select —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-3 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Posting...' : 'Reclassify'}
          </button>
        </div>
      </form>
    </FormPage>
  )
}
