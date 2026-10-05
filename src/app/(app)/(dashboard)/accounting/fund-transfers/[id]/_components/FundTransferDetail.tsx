'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Pencil, Printer } from 'lucide-react'
import { BankTransfers, type FundTransfer, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { printInterAccountTransferVoucherDocument } from '@/src/libs/print/printInventoryDocument'

const d = (v: string | null | undefined) => (v ? v.slice(0, 10) : '—')

// Scenario 61 — one Inter-Account Transfer. Only Clearing Date and Reference
// are editable: neither moves money, so an edit never touches the ledger
// amounts. Everything else is what the posted journal entry already says.
export default function FundTransferDetail({ id, canEdit }: { id: string; canEdit: boolean }) {
  const [transfer, setTransfer] = useState<FundTransfer | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ clearingDate: '', reference: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  // Arrived straight from New Transfer: show the "recorded" confirmation and
  // its voucher up front (this replaced a pop-up — no modals).
  const justCreated = useSearchParams().get('created') === '1'

  const load = useCallback(async () => {
    setLoading(true)
    const res = await BankTransfers.get(id)
    if (res.success && res.data) setTransfer(res.data)
    else setNotFound(true)
    setLoading(false)
  }, [id])
  useEffect(() => {
    load()
  }, [load])

  const startEdit = () => {
    if (!transfer) return
    setDraft({
      clearingDate: transfer.clearingDate?.slice(0, 10) ?? '',
      reference: transfer.reference ?? '',
    })
    setError(null)
    setEditing(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transfer) return
    if (draft.clearingDate && draft.clearingDate < transfer.date.slice(0, 10)) {
      setError('Clearing date cannot be earlier than the transfer date.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await BankTransfers.update(transfer.id, {
      clearingDate: draft.clearingDate || null,
      reference: draft.reference.trim() || null,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Could not save changes.')
      return
    }
    setEditing(false)
    load()
  }

  const printVoucher = async () => {
    setPrinting(true)
    const res = await BankTransfers.getDocument(id)
    setPrinting(false)
    if (res.success && res.data) printInterAccountTransferVoucherDocument(res.data)
  }

  if (loading && !transfer) return <div className="p-10 text-sm text-gray-400">Loading...</div>
  if (notFound || !transfer)
    return (
      <div className="p-10 text-sm text-gray-500">
        Transfer not found.{' '}
        <Link href="/accounting/fund-transfers" className="text-purple-700 underline">
          Back to transfer history
        </Link>
      </div>
    )

  const cleared = (at: string | null, rec?: { id: string; statementDate: string } | null) =>
    at ? (
      <span className="text-green-700">
        Cleared
        {rec && (
          <>
            {' in '}
            <Link
              href={`/accounting/bank-reconciliation/${rec.id}`}
              className="underline hover:text-green-900"
            >
              reconciliation of {d(rec.statementDate)}
            </Link>
          </>
        )}
      </span>
    ) : (
      <span className="text-amber-600">Outstanding</span>
    )

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/accounting/fund-transfers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to transfer history
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Inter-Account Transfer</h1>
          <p className="mt-1 text-sm text-gray-500">{transfer.transferNumber}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && !editing && (
            <button
              onClick={startEdit}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 bg-white hover:bg-gray-50 rounded-lg text-gray-700"
            >
              <Pencil className="h-4 w-4" /> Edit
            </button>
          )}
          <button
            onClick={printVoucher}
            disabled={printing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
          >
            <Printer className="h-4 w-4" /> {printing ? 'Preparing...' : 'Print Voucher'}
          </button>
        </div>
      </div>

      {justCreated && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <p className="flex items-center gap-2 text-sm text-green-800">
            <CheckCircle2 className="h-5 w-5" />
            <span>
              <span className="font-semibold">Transfer recorded.</span> Posted to the general
              ledger, and both balances have been updated.
            </span>
          </p>
          <div className="flex gap-2">
            <Link
              href="/accounting/fund-transfers/new"
              className="px-3 py-2 text-sm border border-green-300 bg-white hover:bg-green-100 rounded-lg text-green-800"
            >
              New transfer
            </Link>
            <button
              onClick={printVoucher}
              disabled={printing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              <Printer className="h-4 w-4" /> {printing ? 'Preparing...' : 'Print Voucher'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Item label="From (source)">
            <div className="font-medium text-gray-900">{transfer.sourceBankAccount.name}</div>
            <div className="text-xs text-gray-500">
              {transfer.sourceBankAccount.bankName} · {transfer.sourceBankAccount.accountNumber}
            </div>
          </Item>
          <Item label="To (destination)">
            <div className="font-medium text-gray-900">{transfer.destinationBankAccount.name}</div>
            <div className="text-xs text-gray-500">
              {transfer.destinationBankAccount.bankName} ·{' '}
              {transfer.destinationBankAccount.accountNumber}
            </div>
          </Item>
          <Item label="Amount">
            <span className="text-lg font-semibold tabular-nums">{fmtMoney(transfer.amount)}</span>
          </Item>
          <Item label="Date">{d(transfer.date)}</Item>
          <Item label="Description">{transfer.description ?? '—'}</Item>
          <Item label="Journal entry">
            {transfer.journalEntry ? (
              <Link
                href={`/accounting/journal-entries/${transfer.journalEntry.id}`}
                className="text-purple-700 underline"
              >
                {transfer.journalEntry.code || 'View entry'}
              </Link>
            ) : (
              '—'
            )}
          </Item>
        </dl>

        <div className="mt-6 border-t pt-5">
          {editing ? (
            <form onSubmit={save} className="space-y-3">
              <p className="text-xs text-gray-500">
                Only the clearing date and reference can be changed on a posted transfer.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1">
                    Clearing Date
                  </span>
                  <input
                    type="date"
                    min={transfer.date.slice(0, 10)}
                    value={draft.clearingDate}
                    onChange={(e) => setDraft({ ...draft, clearingDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs font-medium text-gray-600 mb-1">Reference</span>
                  <input
                    maxLength={100}
                    value={draft.reference}
                    onChange={(e) => setDraft({ ...draft, reference: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  />
                </label>
              </div>
              {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <Item label="Clearing Date">
                {transfer.clearingDate ? (
                  d(transfer.clearingDate)
                ) : (
                  <span className="text-amber-600">Not yet cleared</span>
                )}
              </Item>
              <Item label="Reference">{transfer.reference ?? '—'}</Item>
            </dl>
          )}
        </div>

        <div className="mt-6 border-t pt-5">
          <h2 className="text-xs font-semibold uppercase text-gray-500 mb-2">
            Bank reconciliation
          </h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            <Item label={`Out of ${transfer.sourceBankAccount.name}`}>
              {cleared(transfer.sourceClearedAt, transfer.sourceClearedInReconciliation)}
            </Item>
            <Item label={`Into ${transfer.destinationBankAccount.name}`}>
              {cleared(transfer.destinationClearedAt, transfer.destinationClearedInReconciliation)}
            </Item>
          </dl>
        </div>
      </div>
    </div>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-gray-800">{children}</dd>
    </div>
  )
}
