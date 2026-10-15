'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Ban, CheckCircle2, Pencil, Printer } from 'lucide-react'
import { BankTransfers, type FundTransfer, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { printInterAccountTransferVoucherDocument } from '@/src/libs/print/printInventoryDocument'
import TransferStatusBadge from '../../_components/TransferStatusBadge'
import { Select } from '@/src/components/ui/Select'
import { CLEARED_OPTIONS, type ClearedType } from '../../_components/clearedOptions'
import FundTransferAttachmentsPanel from '../../_components/FundTransferAttachmentsPanel'

const d = (v: string | null | undefined) => (v ? v.slice(0, 10) : '—')

// Scenario 61 — one Inter-Account Transfer. Only Clearing Date and Reference
// are editable: neither moves money, so an edit never touches the ledger
// amounts. Everything else is what the posted journal entry already says.
//
// Scenario 72 — a posted transfer can be voided (reverses its journal entry).
// The reason is typed on the page itself; there is no pop-up. `canEdit` is the
// transfer permission, which is also what the backend asks of a void.
export default function FundTransferDetail({ id, canEdit }: { id: string; canEdit: boolean }) {
  const [transfer, setTransfer] = useState<FundTransfer | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    clearedType: 'SAME_DATE' as ClearedType,
    clearingDate: '',
    reference: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voidBusy, setVoidBusy] = useState(false)
  const [voidError, setVoidError] = useState<string | null>(null)
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
    // Same date when the clearing date is the transfer date; anything else — a
    // later date, or none recorded yet — is "On a later date", which asks for one.
    const clearing = transfer.clearingDate?.slice(0, 10) ?? ''
    setDraft({
      clearedType:
        clearing !== '' && clearing === transfer.date.slice(0, 10) ? 'SAME_DATE' : 'LATER_DATE',
      clearingDate: clearing,
      reference: transfer.reference ?? '',
    })
    setError(null)
    setEditing(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transfer) return
    const transferDate = transfer.date.slice(0, 10)
    if (draft.clearedType === 'LATER_DATE') {
      if (!draft.clearingDate) {
        setError('Pick the date this transfer is expected to clear.')
        return
      }
      if (draft.clearingDate < transferDate) {
        setError('Clearing date cannot be earlier than the transfer date.')
        return
      }
    }
    setSaving(true)
    setError(null)
    const res = await BankTransfers.update(transfer.id, {
      clearingDate: draft.clearedType === 'SAME_DATE' ? transferDate : draft.clearingDate,
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

  const voidTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transfer) return
    if (!voidReason.trim()) {
      setVoidError('Enter the reason for voiding this transfer.')
      return
    }
    setVoidBusy(true)
    setVoidError(null)
    const res = await BankTransfers.void(transfer.id, voidReason.trim())
    setVoidBusy(false)
    if (!res.success) {
      setVoidError(res.message || res.error || 'Could not void this transfer.')
      return
    }
    setVoiding(false)
    setVoidReason('')
    load()
  }

  const printVoucher = async () => {
    setPrinting(true)
    const res = await BankTransfers.getDocument(id)
    setPrinting(false)
    if (res.success && res.data) printInterAccountTransferVoucherDocument(res.data)
  }

  if (loading && !transfer) return <div className="p-10 text-sm text-gray-400">Loading</div>
  if (notFound || !transfer)
    return (
      <div className="p-10 text-sm text-gray-500">
        Transfer not found.{' '}
        <Link href="/accounting/fund-transfers" className="text-purple-700 underline">
          Back to transfer history
        </Link>
      </div>
    )

  const isVoid = transfer.status === 'VOID'

  // A void transfer can never clear a bank, so neither "Not yet reconciled" nor
  // "Not yet cleared" is true of it — say so instead.
  const cleared = (at: string | null, rec?: { id: string; statementDate: string } | null) =>
    isVoid ? (
      <span className="text-gray-400">Not applicable — voided</span>
    ) : at ? (
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
      <span className="text-amber-600">Not yet reconciled</span>
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
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            {transfer.transferNumber}
            <TransferStatusBadge status={transfer.clearingStatus} />
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && !editing && !isVoid && (
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
            <Printer className="h-4 w-4" /> {printing ? 'Preparing' : 'Print Voucher'}
          </button>
        </div>
      </div>

      {justCreated && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <p className="flex items-center gap-2 text-sm text-green-800">
            <CheckCircle2 className="h-5 w-5" />
            <span>
              <span className="font-semibold">Transfer recorded.</span> Posted to the general
              ledger, and both balances have been updated.
            </span>
          </p>
        </div>
      )}

      {isVoid && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          <p className="font-semibold">
            This transfer was voided on {d(transfer.voidedAt)}. Its journal entry has been reversed.
          </p>
          {transfer.voidReason && <p className="mt-1">Reason: {transfer.voidReason}</p>}
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
          <Item label="Branch / Location">{transfer.branch?.name ?? 'Head office'}</Item>
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
                  <span className="block text-xs font-medium text-gray-600 mb-1">Cleared</span>
                  <Select
                    compact
                    value={draft.clearedType}
                    onChange={(value) =>
                      setDraft({
                        ...draft,
                        clearedType: value as ClearedType,
                        // Switching to a later date starts from the transfer date.
                        clearingDate:
                          value === 'LATER_DATE'
                            ? draft.clearingDate || transfer.date.slice(0, 10)
                            : draft.clearingDate,
                      })
                    }
                    options={CLEARED_OPTIONS}
                  />
                </label>
                {draft.clearedType === 'LATER_DATE' && (
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-600 mb-1">
                      Cleared Date *
                    </span>
                    <input
                      required
                      type="date"
                      min={transfer.date.slice(0, 10)}
                      value={draft.clearingDate}
                      onChange={(e) => setDraft({ ...draft, clearingDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                    />
                  </label>
                )}
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
                  {saving ? 'Saving' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <Item label="Clearing Date">
                {transfer.clearingDate ? (
                  d(transfer.clearingDate)
                ) : isVoid ? (
                  '—'
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

        {/* Scenario 72 Part 5 — a bank advice often arrives after the transfer, so
            documents can be added or removed after posting (they are not a money
            field); a void transfer, or a user who can't change transfers, only looks. */}
        <div className="mt-6 border-t pt-5">
          <FundTransferAttachmentsPanel transferId={transfer.id} readOnly={isVoid || !canEdit} />
        </div>

        {canEdit && !isVoid && (
          <div className="mt-6 border-t pt-5">
            <h2 className="text-xs font-semibold uppercase text-gray-500 mb-2">Void transfer</h2>
            {voiding ? (
              <form onSubmit={voidTransfer} className="space-y-3" aria-label="Void transfer">
                <p className="text-xs text-gray-500">
                  Voiding reverses this transfer&apos;s journal entry, puts both accounts&apos;
                  balances back and takes it off any open bank reconciliation. The transfer stays in
                  the history, marked VOID. It cannot be undone.
                </p>
                <label className="block max-w-2xl">
                  <span className="block text-xs font-medium text-gray-600 mb-1">Reason *</span>
                  <textarea
                    required
                    rows={2}
                    maxLength={500}
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    placeholder="e.g. Keyed against the wrong destination account"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  />
                </label>
                {voidError && (
                  <div className="max-w-2xl p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {voidError}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setVoiding(false)
                      setVoidReason('')
                      setVoidError(null)
                    }}
                    disabled={voidBusy}
                    className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg text-gray-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={voidBusy}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg disabled:opacity-50"
                  >
                    <Ban className="h-4 w-4" /> {voidBusy ? 'Voiding' : 'Void transfer'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setVoiding(true)}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-red-200 bg-white hover:bg-red-50 rounded-lg text-red-700"
              >
                <Ban className="h-4 w-4" /> Void this transfer
              </button>
            )}
          </div>
        )}
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
