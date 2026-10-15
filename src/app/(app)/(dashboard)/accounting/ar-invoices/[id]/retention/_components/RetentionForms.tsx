'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import {
  ARInvoices,
  BankAccounts,
  fmtMoney,
  type BankAccount,
  type RetentionHistory,
  type RetentionOffsetReason,
} from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'
import { postableAccounts } from '@/src/libs/accounting/coa-options'
import Field from '../../../../_shared/Field'

const inputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100 disabled:bg-gray-50'
const today = () => new Date().toISOString().slice(0, 10)

/** Loads the invoice's retention so each form can say how much is still held. */
function useRetention(id: string) {
  const [history, setHistory] = useState<RetentionHistory | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    ARInvoices.retentionHistory(id).then((res) => {
      if (cancelled) return
      if (res.success && res.data) setHistory(res.data)
      else setError(res.error || res.message || 'Could not load this invoice’s retention.')
    })
    return () => {
      cancelled = true
    }
  }, [id])
  return { history, error }
}

function Shell({
  id,
  title,
  intro,
  history,
  error,
  saving,
  submitLabel,
  disabled,
  onSubmit,
  children,
}: {
  id: string
  title: string
  intro: string
  history: RetentionHistory | null
  error: string
  saving: boolean
  submitLabel: string
  disabled: boolean
  onSubmit: () => void
  children: React.ReactNode
}) {
  const back = `/accounting/ar-invoices/${id}`
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="px-6 py-5 lg:px-10"
      data-testid="retention-form"
    >
      <Link
        href={back}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to the invoice
      </Link>
      <h1 className="text-2xl font-semibold text-prominent-purple-900">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">{intro}</p>
      {history && (
        <p className="mt-3 text-sm text-gray-700">
          Invoice <span className="font-mono font-semibold">{history.invoiceNumber}</span> ·
          retained {fmtMoney(history.retentionAmount)} · still held{' '}
          <span className="font-semibold">{fmtMoney(history.held)}</span>
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mt-4 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700"
        >
          {error}
        </div>
      )}
      <div className="mt-5 space-y-4">{children}</div>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || disabled}
          data-testid="retention-submit"
          className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-5 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? 'Posting…' : submitLabel}
        </button>
        <Link href={back} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">
          Cancel
        </Link>
      </div>
    </form>
  )
}

// 11M — the customer finally pays the retained amount.
export function ReleaseRetentionForm({ id }: { id: string }) {
  const router = useRouter()
  const { history, error: loadError } = useRetention(id)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [method, setMethod] = useState<'CASH' | 'CHECK' | 'BANK_TRANSFER' | 'QR' | 'CARD'>(
    'BANK_TRANSFER'
  )
  const [bankId, setBankId] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    BankAccounts.list().then((r) => setBanks((r.data ?? []).filter((b) => b.isActive)))
  }, [])
  useEffect(() => {
    if (history && amount === '') setAmount(String(history.held))
  }, [history, amount])

  const value = Number(amount) || 0
  const needsBank = method !== 'CASH'
  const disabled =
    !history ||
    value <= 0 ||
    value - history.held > 0.005 ||
    !reference.trim() ||
    (needsBank && !bankId)

  const submit = async () => {
    setSaving(true)
    setError('')
    const res = await ARInvoices.releaseRetention(id, {
      amount: value,
      releaseDate: date,
      method,
      bankAccountId: needsBank ? bankId : undefined,
      reference: reference.trim(),
      notes: notes.trim() || undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.error || res.message || 'The release could not be recorded.')
      return
    }
    router.push(`/accounting/ar-invoices/${id}`)
  }

  return (
    <Shell
      id={id}
      title="Record retention release"
      intro="The customer has paid the retained amount after acceptance, completion or the warranty period. The cash comes in and the Retention Receivable is cleared; the invoice closes when nothing is left."
      history={history}
      error={error || loadError}
      saving={saving}
      submitLabel="Record release"
      disabled={disabled}
      onSubmit={submit}
    >
      <div className="grid gap-3 lg:grid-cols-4">
        <Field label="Amount released *">
          <input
            type="number"
            step="0.01"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
            data-testid="retention-amount"
          />
        </Field>
        <Field label="Date received *">
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Paid by *">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as typeof method)}
            className={inputClass}
          >
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CHECK">Check</option>
            <option value="CASH">Cash</option>
            <option value="QR">QR / online</option>
            <option value="CARD">Card</option>
          </select>
        </Field>
        {needsBank && (
          <Field label="Source of fund *">
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              className={inputClass}
            >
              <option value="">— Select a bank account —</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} · {b.bankName}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <Field label="Release document / bank reference *">
        <input
          value={reference}
          maxLength={100}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Acceptance certificate no. or bank reference"
          className={inputClass}
        />
      </Field>
      <Field label="Notes">
        <textarea
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </Field>
    </Shell>
  )
}

// 11N — settled against a valid customer claim, defect or penalty.
export function OffsetRetentionForm({ id }: { id: string }) {
  const router = useRouter()
  const { history, error: loadError } = useRetention(id)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [accountId, setAccountId] = useState('')
  const [reason, setReason] = useState<RetentionOffsetReason>('WARRANTY')
  const [reference, setReference] = useState('')
  const [approvedBy, setApprovedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAccounts({ limit: 500 }).then((r) => {
      const list = ((r.data as unknown as { items?: Account[] })?.items ??
        r.data ??
        []) as Account[]
      // A claim is a cost or a reduction of sales — never another balance sheet
      // account, which would only move the receivable somewhere else.
      setAccounts(
        postableAccounts(list).filter((a) =>
          ['EXPENSE', 'REVENUE'].includes((a.type ?? '').toString().toUpperCase())
        )
      )
    })
  }, [])
  const sorted = useMemo(
    () =>
      [...accounts].sort((a, b) =>
        (a.number ?? '').localeCompare(b.number ?? '', undefined, { numeric: true })
      ),
    [accounts]
  )

  const value = Number(amount) || 0
  const disabled =
    !history ||
    value <= 0 ||
    value - history.held > 0.005 ||
    !accountId ||
    !reference.trim() ||
    !approvedBy.trim()

  const submit = async () => {
    setSaving(true)
    setError('')
    const res = await ARInvoices.offsetRetention(id, {
      amount: value,
      offsetDate: date,
      offsetAccountId: accountId,
      reasonCode: reason,
      reference: reference.trim(),
      approvedBy: approvedBy.trim(),
      notes: notes.trim() || undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.error || res.message || 'The offset could not be posted.')
      return
    }
    router.push(`/accounting/ar-invoices/${id}`)
  }

  return (
    <Shell
      id={id}
      title="Offset retention against a claim"
      intro="The customer validly keeps part of the retention against a claim, defect or penalty. This is not a collection: no cash moves, the claim is charged to the account you pick, and it needs an approval and its supporting memo."
      history={history}
      error={error || loadError}
      saving={saving}
      submitLabel="Post offset"
      disabled={disabled}
      onSubmit={submit}
    >
      <div className="grid gap-3 lg:grid-cols-3">
        <Field label="Amount offset *">
          <input
            type="number"
            step="0.01"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
            data-testid="retention-amount"
          />
        </Field>
        <Field label="Date *">
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Reason *">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as RetentionOffsetReason)}
            className={inputClass}
          >
            <option value="WARRANTY">Warranty / defect</option>
            <option value="SALES_RETURN">Sales return</option>
            <option value="PENALTY">Penalty</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
      </div>
      <Field label="Charged to *">
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className={inputClass}
        >
          <option value="">
            — Sales Returns and Allowances, Warranty / Service Expense, Penalty… —
          </option>
          {sorted.map((a) => (
            <option key={a.id} value={a.id}>
              {a.number} · {a.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-3 lg:grid-cols-2">
        <Field label="Offset memo / claim notice no. *">
          <input
            value={reference}
            maxLength={100}
            onChange={(e) => setReference(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Approved by *">
          <input
            value={approvedBy}
            maxLength={255}
            onChange={(e) => setApprovedBy(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Notes">
        <textarea
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </Field>
    </Shell>
  )
}

// 11O — doubtful or uncollectible.
export function DoubtfulRetentionForm({ id }: { id: string }) {
  const router = useRouter()
  const { history, error: loadError } = useRetention(id)
  const [mode, setMode] = useState<'PROVISION' | 'WRITE_OFF'>('PROVISION')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [reference, setReference] = useState('')
  const [approvedBy, setApprovedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const value = Number(amount) || 0
  const disabled =
    !history ||
    value <= 0 ||
    value - history.held > 0.005 ||
    !reference.trim() ||
    !approvedBy.trim()

  const submit = async () => {
    setSaving(true)
    setError('')
    const res = await ARInvoices.doubtfulRetention(id, {
      mode,
      amount: value,
      actionDate: date,
      reference: reference.trim(),
      approvedBy: approvedBy.trim(),
      notes: notes.trim() || undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.error || res.message || 'It could not be posted.')
      return
    }
    router.push(`/accounting/ar-invoices/${id}`)
  }

  return (
    <Shell
      id={id}
      title="Doubtful or uncollectible retention"
      intro="Use only after a collection review and with approval. A provision sets an allowance aside (Bad Debts Expense against the Allowance for Doubtful Accounts) and the retention stays held; a write-off takes it off the books against that allowance."
      history={history}
      error={error || loadError}
      saving={saving}
      submitLabel={mode === 'WRITE_OFF' ? 'Post write-off' : 'Post provision'}
      disabled={disabled}
      onSubmit={submit}
    >
      <div
        role="radiogroup"
        aria-label="What to do"
        className="inline-grid grid-flow-col gap-1 rounded-lg bg-gray-100 p-0.5"
      >
        {(
          [
            ['PROVISION', 'Provide for it (keep held)'],
            ['WRITE_OFF', 'Write it off'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              mode === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Field label="Amount *">
          <input
            type="number"
            step="0.01"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
            data-testid="retention-amount"
          />
        </Field>
        <Field label="Date *">
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Allowance / write-off memo no. *">
          <input
            value={reference}
            maxLength={100}
            onChange={(e) => setReference(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Approved by *">
        <input
          value={approvedBy}
          maxLength={255}
          onChange={(e) => setApprovedBy(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Notes (collection review)">
        <textarea
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </Field>
    </Shell>
  )
}
