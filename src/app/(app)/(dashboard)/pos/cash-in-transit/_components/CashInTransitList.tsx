'use client'

import { useCallback, useEffect, useState } from 'react'
import { Landmark, X, History, ArrowLeft, Loader2 } from 'lucide-react'
import {
  getCashInTransitReport,
  getCashInTransitHistory,
  clearCashInTransit,
  type CashInTransitSessionRow,
  type CashInTransitHistoryRow,
} from '../../_actions/pos-actions'
import { BankAccounts, type BankAccount, fmtMoney, fmtDate } from '@/src/libs/data/AccountingV2Data'

export function CashInTransitList({
  canManage,
  restrictedBranchId,
}: {
  canManage: boolean
  restrictedBranchId: string | null
}) {
  const [rows, setRows] = useState<CashInTransitSessionRow[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [depositing, setDepositing] = useState(false)

  // History view
  const [showHistory, setShowHistory] = useState(false)
  const [historyRows, setHistoryRows] = useState<CashInTransitHistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [report, banks] = await Promise.all([
      getCashInTransitReport(restrictedBranchId ? { branchId: restrictedBranchId } : undefined),
      BankAccounts.list(),
    ])
    setRows(report.data ?? [])
    setAccounts(banks.data ?? [])
    setSelected(new Set())
    setLoading(false)
  }, [restrictedBranchId])

  useEffect(() => {
    load()
  }, [load])

  async function loadHistory() {
    setHistoryLoading(true)
    setHistoryError('')
    const res = await getCashInTransitHistory(
      restrictedBranchId ? { branchId: restrictedBranchId } : undefined
    )
    if (res.success && res.data) {
      setHistoryRows(res.data)
    } else {
      setHistoryError(res.error ?? 'Failed to load history.')
    }
    setHistoryLoading(false)
  }

  function openHistory() {
    setShowHistory(true)
    loadHistory()
  }

  function closeHistory() {
    setShowHistory(false)
    setHistoryRows([])
    setHistoryError('')
  }

  const toggle = (sessionId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.sessionId))
    )
  }

  const selectedRows = rows.filter((r) => selected.has(r.sessionId))
  const selectedTotal = selectedRows.reduce((s, r) => s + Number(r.amount || 0), 0)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          {showHistory ? (
            <>
              <button
                onClick={closeHistory}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft size={15} />
                Back to Cash-in-Transit
              </button>
              <h2 className="mt-1 text-2xl font-bold text-prominent-purple-900">
                Cash-in-Transit History
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">Sessions already deposited to a bank.</p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-prominent-purple-900">Cash-in-Transit</h2>
              <p className="text-sm text-gray-500">
                Closed sessions with cash still awaiting an actual bank deposit.
              </p>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {!showHistory && (
            <button
              onClick={openHistory}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <History className="w-4 h-4" /> History
            </button>
          )}
          {!showHistory && canManage && (
            <button
              onClick={() => setDepositing(true)}
              disabled={selected.size === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50"
            >
              <Landmark className="w-4 h-4" /> Deposit Selected to Bank
              {selected.size > 0 && ` (${selected.size})`}
            </button>
          )}
        </div>
      </div>

      {showHistory ? (
        <>
          {historyError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {historyError}
            </div>
          )}
          <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Branch</th>
                  <th className="px-3 py-2 text-left">Terminal</th>
                  <th className="px-3 py-2 text-left">Cashier</th>
                  <th className="px-3 py-2 text-left">Closed At</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Cleared At</th>
                  <th className="px-3 py-2 text-left">Deposited To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historyLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading history...
                    </td>
                  </tr>
                ) : historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                      No Cash-in-Transit history yet.
                    </td>
                  </tr>
                ) : (
                  historyRows.map((r) => (
                    <tr key={r.sessionId} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{r.branchName ?? '—'}</td>
                      <td className="px-3 py-2">{r.terminalCode ?? '—'}</td>
                      <td className="px-3 py-2">{r.cashierName ?? '—'}</td>
                      <td className="px-3 py-2 text-xs">{fmtDate(r.closedAt)}</td>
                      <td className="px-3 py-2 text-right">{fmtMoney(r.amount)}</td>
                      <td className="px-3 py-2 text-xs">{fmtDate(r.citClearedAt)}</td>
                      <td className="px-3 py-2">{r.depositedTo ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                {canManage && (
                  <th className="px-3 py-2 text-left w-10">
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && selected.size === rows.length}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                <th className="px-3 py-2 text-left">Branch</th>
                <th className="px-3 py-2 text-left">Terminal</th>
                <th className="px-3 py-2 text-left">Cashier</th>
                <th className="px-3 py-2 text-left">Closed At</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="px-3 py-8 text-center text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="px-3 py-8 text-center text-gray-400">
                    No outstanding Cash-in-Transit sessions.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.sessionId}
                    onClick={canManage ? () => toggle(r.sessionId) : undefined}
                    className={`hover:bg-gray-50 ${canManage ? 'cursor-pointer' : ''}`}
                  >
                    {canManage && (
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(r.sessionId)}
                          onChange={() => toggle(r.sessionId)}
                        />
                      </td>
                    )}
                    <td className="px-3 py-2">{r.branchName ?? '—'}</td>
                    <td className="px-3 py-2">{r.terminalCode ?? '—'}</td>
                    <td className="px-3 py-2">{r.cashierName ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{fmtDate(r.closedAt)}</td>
                    <td className="px-3 py-2 text-right">{fmtMoney(r.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {depositing && (
        <DepositForm
          accounts={accounts}
          sessions={selectedRows}
          totalAmount={selectedTotal}
          onClose={() => setDepositing(false)}
          onSaved={() => {
            setDepositing(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function DepositForm({
  accounts,
  sessions,
  totalAmount,
  onClose,
  onSaved,
}: {
  accounts: BankAccount[]
  sessions: CashInTransitSessionRow[]
  totalAmount: number
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    bankAccountId: '',
    depositDate: new Date().toISOString().slice(0, 10),
    reference: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await clearCashInTransit({
      bankAccountId: form.bankAccountId,
      sessionIds: sessions.map((s) => s.sessionId),
      depositDate: form.depositDate,
      reference: form.reference || undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.error || res.message || 'Failed to clear Cash-in-Transit')
      return
    }
    alert('Cash-in-Transit deposit posted to GL.')
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Deposit Selected to Bank</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <p className="text-xs text-gray-500">
            Clearing {sessions.length} session{sessions.length === 1 ? '' : 's'} totalling{' '}
            <span className="font-semibold">{fmtMoney(totalAmount)}</span>. Posts a single
            Cash-in-Bank deposit journal entry.
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
            <span className="block text-xs font-medium text-gray-600 mb-1">Deposit Date *</span>
            <input
              required
              type="date"
              value={form.depositDate}
              onChange={(e) => setForm({ ...form, depositDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Reference</span>
            <input
              value={form.reference}
              onChange={(e) => setForm({ ...form, reference: e.target.value })}
              placeholder="Deposit slip / reference number"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
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
              disabled={saving || !form.bankAccountId}
              className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? 'Posting...' : 'Deposit to Bank'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
