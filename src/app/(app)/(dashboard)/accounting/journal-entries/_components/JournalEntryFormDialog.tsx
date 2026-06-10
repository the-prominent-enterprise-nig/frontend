'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import {
  getAccounts,
  createJournalEntry,
  updateJournalEntry,
  type JournalEntry,
  type JournalEntryInput,
  type Account,
} from '@/src/libs/data/AccountingData'

const JOURNAL_TYPES = [
  'GeneralJournal',
  'SALES',
  'PURCHASE',
  'CASH_RECEIPT',
  'CASH_DISBURSEMENT',
  'ADJUSTMENT',
]

interface TxLine {
  accountId: string
  item: string
  description: string
  quantity: string
  unitPrice: string
  debit: string
  credit: string
}

interface Props {
  initial: JournalEntry | null
  onClose: () => void
  onSaved: () => void
}

function fmt(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2 })
}

export default function JournalEntryFormDialog({ initial, onClose, onSaved }: Props) {
  const isEdit = !!initial

  const [reference, setReference] = useState((initial as any)?.reference ?? '')
  const [date, setDate] = useState(
    initial?.date
      ? new Date(initial.date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  )
  const [description, setDescription] = useState(initial?.description ?? '')
  const [journalType, setJournalType] = useState(
    (initial?.journalType as string) ?? 'GeneralJournal'
  )
  const [payee, setPayee] = useState((initial as any)?.payee ?? '')

  const [lines, setLines] = useState<TxLine[]>(() => {
    if (initial?.transactions?.length) {
      return initial.transactions.map((t) => ({
        accountId: t.accountId,
        item: (t as any).item ?? '',
        description: t.description ?? '',
        quantity: (t as any).quantity != null ? String((t as any).quantity) : '',
        unitPrice: (t as any).unitPrice != null ? String((t as any).unitPrice) : '',
        debit: t.debit ? String(t.debit) : '',
        credit: t.credit ? String(t.credit) : '',
      }))
    }
    return [
      {
        accountId: '',
        item: '',
        description: '',
        quantity: '',
        unitPrice: '',
        debit: '',
        credit: '',
      },
      {
        accountId: '',
        item: '',
        description: '',
        quantity: '',
        unitPrice: '',
        debit: '',
        credit: '',
      },
    ]
  })

  const [accounts, setAccounts] = useState<Account[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAccounts({ limit: 500 }).then((res) => {
      if (res.success && res.data) {
        const d = res.data as any
        setAccounts(d?.items ?? d ?? [])
      }
    })
  }, [])

  const subtotals = useMemo(
    () => lines.map((l) => (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0)),
    [lines]
  )
  const totalDebit = useMemo(() => lines.reduce((s, l) => s + (Number(l.debit) || 0), 0), [lines])
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + (Number(l.credit) || 0), 0), [lines])
  const grandTotal = useMemo(() => subtotals.reduce((s, v) => s + v, 0), [subtotals])
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01

  const updateLine = (i: number, patch: Partial<TxLine>) =>
    setLines((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      {
        accountId: '',
        item: '',
        description: '',
        quantity: '',
        unitPrice: '',
        debit: '',
        credit: '',
      },
    ])

  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const cleanLines = lines.filter((l) => l.accountId)
    if (cleanLines.length === 0) {
      setError('Add at least one transaction line with an account.')
      return
    }

    setSaving(true)
    const payload: JournalEntryInput = {
      reference: reference || undefined,
      date,
      description: description || undefined,
      journalType: journalType as any,
      payee: payee || undefined,
      transactions: cleanLines.map((l) => ({
        accountId: l.accountId,
        item: l.item || undefined,
        quantity: l.quantity !== '' ? Number(l.quantity) : undefined,
        unitPrice: l.unitPrice !== '' ? Number(l.unitPrice) : undefined,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description || undefined,
      })),
    }

    const res = isEdit
      ? await updateJournalEntry(initial!.id, payload)
      : await createJournalEntry(payload)
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Save failed')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Journal Entry' : 'New Journal Entry'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col overflow-hidden flex-1">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Header fields */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Reference No.
                </label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="JE-001"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Journal Type</label>
                <select
                  value={journalType}
                  onChange={(e) => setJournalType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  {JOURNAL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payee</label>
                <input
                  value={payee}
                  onChange={(e) => setPayee(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>

            {/* Transaction lines */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-medium text-gray-700">Transaction Lines</label>
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 rounded"
                >
                  <Plus className="w-3 h-3" /> Add line
                </button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="px-2 py-2 text-left min-w-[160px]">Account</th>
                      <th className="px-2 py-2 text-left min-w-[120px]">Item</th>
                      <th className="px-2 py-2 text-left min-w-[110px]">Description</th>
                      <th className="px-2 py-2 text-right w-20">Qty</th>
                      <th className="px-2 py-2 text-right w-28">Unit Price</th>
                      <th className="px-2 py-2 text-right w-28">Subtotal</th>
                      <th className="px-2 py-2 text-right w-28">Debit</th>
                      <th className="px-2 py-2 text-right w-28">Credit</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((line, i) => (
                      <tr key={i}>
                        <td className="px-1 py-1">
                          <select
                            value={line.accountId}
                            onChange={(e) => updateLine(i, { accountId: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                          >
                            <option value="">— Select —</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.code ?? (a as any).number} — {a.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={line.item}
                            onChange={(e) => updateLine(i, { item: e.target.value })}
                            placeholder="Item name"
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={line.description}
                            onChange={(e) => updateLine(i, { description: e.target.value })}
                            placeholder="optional"
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={line.quantity}
                            onChange={(e) => updateLine(i, { quantity: e.target.value })}
                            placeholder="0"
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-purple-500 outline-none text-right"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.unitPrice}
                            onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-purple-500 outline-none text-right"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right text-sm text-gray-700 tabular-nums whitespace-nowrap">
                          {subtotals[i] ? fmt(subtotals[i]) : '—'}
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.debit}
                            onChange={(e) =>
                              updateLine(i, {
                                debit: e.target.value,
                                credit: e.target.value ? '' : line.credit,
                              })
                            }
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-purple-500 outline-none text-right"
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.credit}
                            onChange={(e) =>
                              updateLine(i, {
                                credit: e.target.value,
                                debit: e.target.value ? '' : line.debit,
                              })
                            }
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-purple-500 outline-none text-right"
                          />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(i)}
                            disabled={lines.length <= 1}
                            className="p-1 rounded hover:bg-red-50 text-red-500 disabled:opacity-30"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr>
                      <td
                        colSpan={5}
                        className="px-2 py-2 text-right text-xs font-semibold text-gray-600"
                      >
                        Total
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-bold text-gray-900 tabular-nums">
                        {grandTotal ? fmt(grandTotal) : '—'}
                      </td>
                      <td
                        className={`px-2 py-2 text-right text-sm font-bold tabular-nums ${balanced ? 'text-emerald-700' : 'text-red-600'}`}
                      >
                        {fmt(totalDebit)}
                      </td>
                      <td
                        className={`px-2 py-2 text-right text-sm font-bold tabular-nums ${balanced ? 'text-emerald-700' : 'text-red-600'}`}
                      >
                        {fmt(totalCredit)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {!balanced && totalDebit > 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  Entry is unbalanced (difference: {fmt(Math.abs(totalDebit - totalCredit))}). You
                  can still save as DRAFT.
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
