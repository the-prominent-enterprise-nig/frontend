'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Pencil, Trash2 } from 'lucide-react'
import {
  BankAccounts,
  fmtMoney,
  fmtDate,
  type BankReconciliation,
  type BankReconciliationLine,
  type BankReconciliationLineSourceType,
} from '@/src/libs/data/AccountingV2Data'

const SOURCE_LABELS: Record<BankReconciliationLineSourceType, string> = {
  AR_PAYMENT: 'AR Collection',
  AP_PAYMENT: 'AP Check Payment',
  CLEARING_SETTLEMENT: 'Clearing Settlement',
}

// Scenario 42 — the reconciliation worksheet. Statement Balance and System
// Balance both come from the backend (typed in once at creation, computed
// respectively); everything below is generated. Checking a line off against
// the real bank statement PATCHes it immediately (persisted per-line, not
// batched at Complete) so progress survives a refresh mid-session.
export default function ReconciliationWorksheet({ id }: { id: string }) {
  const router = useRouter()
  const [rec, setRec] = useState<BankReconciliation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completing, setCompleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    statementDate: '',
    statementBalance: '',
    notes: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await BankAccounts.getReconciliationWorksheet(id)
    if (res.success && res.data) setRec(res.data)
    else setError(res.message || res.error || 'Failed to load worksheet')
    setLoading(false)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const toggleLine = async (line: BankReconciliationLine) => {
    if (!rec || rec.reconciled) return
    const nextChecked = !line.checked
    // Optimistic update — reverted below if the PATCH fails.
    setRec({
      ...rec,
      lines: rec.lines.map((l) => (l.id === line.id ? { ...l, checked: nextChecked } : l)),
      pendingDeposits: (rec.pendingDeposits ?? []).map((l) =>
        l.id === line.id ? { ...l, checked: nextChecked } : l
      ),
      pendingWithdrawals: (rec.pendingWithdrawals ?? []).map((l) =>
        l.id === line.id ? { ...l, checked: nextChecked } : l
      ),
    })
    const res = await BankAccounts.toggleReconciliationLine(id, line.id, nextChecked)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to update line')
      load()
    }
  }

  const openEdit = () => {
    if (!rec) return
    setEditForm({
      statementDate: String(rec.statementDate).slice(0, 10),
      statementBalance: String(rec.statementBalance),
      notes: rec.notes ?? '',
    })
    setEditing(true)
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingEdit(true)
    setError(null)
    const res = await BankAccounts.updateReconciliation(id, {
      statementDate: editForm.statementDate,
      statementBalance: Number(editForm.statementBalance),
      notes: editForm.notes,
    })
    setSavingEdit(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to update reconciliation')
      return
    }
    setEditing(false)
    // A new statement date rebuilds the worksheet server-side, so re-read the
    // whole thing rather than patching the header in place.
    load()
  }

  const remove = async () => {
    if (!rec) return
    const clearedCount = rec.lines.filter((l) => l.checked).length
    const warning =
      rec.reconciled && clearedCount > 0
        ? `Delete this completed reconciliation? The ${clearedCount} item${
            clearedCount === 1 ? '' : 's'
          } it cleared go back to pending and reappear in this account's next worksheet.`
        : 'Delete this reconciliation? Its worksheet is discarded.'
    if (!confirm(`${warning} This cannot be undone.`)) return
    setDeleting(true)
    setError(null)
    const res = await BankAccounts.deleteReconciliation(id)
    if (!res.success) {
      setDeleting(false)
      setError(res.message || res.error || 'Failed to delete reconciliation')
      return
    }
    router.push('/accounting/bank-reconciliation')
  }

  const complete = async () => {
    setCompleting(true)
    setError(null)
    const res = await BankAccounts.completeReconciliation(id)
    setCompleting(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to complete reconciliation')
      return
    }
    load()
  }

  if (loading) {
    return <div className="p-6 text-sm text-gray-400">Loading worksheet...</div>
  }
  if (!rec) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-700">{error || 'Reconciliation not found.'}</p>
        <Link
          href="/accounting/bank-reconciliation"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to bank reconciliation
        </Link>
      </div>
    )
  }

  const pendingDeposits = rec.pendingDeposits ?? []
  const pendingWithdrawals = rec.pendingWithdrawals ?? []
  const checkedDeposits = pendingDeposits.filter((l) => l.checked).reduce((s, l) => s + l.amount, 0)
  const checkedWithdrawals = pendingWithdrawals
    .filter((l) => l.checked)
    .reduce((s, l) => s + l.amount, 0)
  const adjustedBalance = rec.statementBalance + checkedDeposits - checkedWithdrawals
  const discrepancy = adjustedBalance - rec.systemBalance
  const isZero = Math.abs(discrepancy) < 0.01

  return (
    <div className="px-6 py-8 lg:px-10 max-w-5xl mx-auto">
      <Link
        href="/accounting/bank-reconciliation"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to bank reconciliation
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {rec.bankAccount?.name ?? 'Reconciliation'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">Statement date {fmtDate(rec.statementDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          {rec.reconciled ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-200">
              <CheckCircle className="w-4 h-4" />
              Reconciled
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-sm font-semibold border border-amber-200">
              Pending
            </span>
          )}
          {/* Editing is open-only: a completed worksheet's lines are locked
              and its clearings are already written, so the way back from a
              wrong Complete is Delete, which un-clears them. */}
          {!rec.reconciled && (
            <button
              onClick={openEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Pencil className="w-4 h-4" /> Edit
            </button>
          )}
          <button
            onClick={remove}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {editing && (
        <form
          onSubmit={saveEdit}
          className="mt-4 rounded-xl border border-gray-200 bg-white p-4 space-y-3"
        >
          <div>
            <h2 className="text-sm font-semibold text-prominent-purple-900">Edit Reconciliation</h2>
            <p className="text-xs text-gray-500">
              Changing the statement date regenerates the pending items below from the new cutoff.
              Anything you&apos;ve already ticked stays ticked if it&apos;s still in range.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Statement Date</span>
              <input
                required
                type="date"
                value={editForm.statementDate}
                onChange={(e) => setEditForm({ ...editForm, statementDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">
                Statement Balance
              </span>
              <input
                required
                type="number"
                step="0.01"
                value={editForm.statementBalance}
                onChange={(e) => setEditForm({ ...editForm, statementBalance: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Notes</span>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryTile label="Statement Balance" value={rec.statementBalance} />
        <SummaryTile label="System Balance" value={rec.systemBalance} hint="Computed from the GL" />
        <SummaryTile label="Adjusted Balance" value={adjustedBalance} />
        <SummaryTile label="Discrepancy" value={discrepancy} tone={isZero ? 'good' : 'bad'} />
      </div>

      {error && (
        <div className="mt-4 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}

      <LineSection
        title="Pending Deposits"
        subtitle="AR collections and clearing settlements not yet confirmed cleared."
        lines={pendingDeposits}
        readOnly={rec.reconciled}
        onToggle={toggleLine}
      />
      <LineSection
        title="Pending Withdrawals"
        subtitle="AP check payments not yet confirmed cleared."
        lines={pendingWithdrawals}
        readOnly={rec.reconciled}
        onToggle={toggleLine}
      />

      {!rec.reconciled && (
        <div className="mt-6 flex items-center justify-end gap-3">
          {!isZero && (
            <p className="text-xs text-amber-700">
              Check off every item that actually cleared until Discrepancy reaches ₱0.00.
            </p>
          )}
          <button
            onClick={complete}
            disabled={completing || !isZero}
            title={isZero ? undefined : 'Discrepancy must be zero before completing'}
            className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {completing ? 'Completing...' : 'Mark Reconciled'}
          </button>
        </div>
      )}
    </div>
  )
}

function SummaryTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: number
  hint?: string
  tone?: 'good' | 'bad'
}) {
  const toneClass =
    tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-amber-700' : 'text-gray-900'
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{fmtMoney(value)}</p>
      {hint && <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

function LineSection({
  title,
  subtitle,
  lines,
  readOnly,
  onToggle,
}: {
  title: string
  subtitle: string
  lines: BankReconciliationLine[]
  readOnly: boolean
  onToggle: (line: BankReconciliationLine) => void
}) {
  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="text-xs text-gray-500">{subtitle}</p>
      <div className="mt-3 bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left w-10"></th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  Nothing pending.
                </td>
              </tr>
            ) : (
              lines.map((l) => (
                <tr key={l.id} className={l.checked ? 'bg-emerald-50/40' : undefined}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={l.checked}
                      disabled={readOnly}
                      onChange={() => onToggle(l)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs">{fmtDate(l.date)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{SOURCE_LABELS[l.sourceType]}</td>
                  <td className="px-3 py-2 text-xs">{l.reference || '—'}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(l.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
