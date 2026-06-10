'use client'
import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, CheckCircle, X, FileEdit } from 'lucide-react'
import {
  BankAccounts,
  BankAdjusting,
  type BankAccount,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'

export default function BankRecon() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [recs, setRecs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [adjusting, setAdjusting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [a, r] = await Promise.all([BankAccounts.list(), BankAccounts.listReconciliations()])
    setAccounts(a.data ?? [])
    setRecs(r.data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])
  const complete = async (id: string) => {
    await BankAccounts.completeReconciliation(id)
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Bank Reconciliation</h2>
          <p className="text-sm text-gray-500">Compare bank statements to system records.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setAdjusting(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-lg"
          >
            <FileEdit className="w-4 h-4" /> Adjusting Entry
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Reconciliation
          </button>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-left">Statement Date</th>
              <th className="px-3 py-2 text-right">Statement Balance</th>
              <th className="px-3 py-2 text-right">System Balance</th>
              <th className="px-3 py-2 text-right">Difference</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : recs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  No reconciliations.
                </td>
              </tr>
            ) : (
              recs.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">{r.bankAccount?.name}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(r.statementDate)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(r.statementBalance)}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(r.systemBalance)}</td>
                  <td
                    className={`px-3 py-2 text-right ${Math.abs(r.statementBalance - r.systemBalance) > 0.01 ? 'text-amber-700' : 'text-emerald-700'}`}
                  >
                    {fmtMoney(r.statementBalance - r.systemBalance)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.reconciled ? (
                      <span className="text-emerald-700">Reconciled</span>
                    ) : (
                      <span className="text-amber-700">Pending</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!r.reconciled && (
                      <button
                        onClick={() => complete(r.id)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {creating && (
        <ReconForm
          accounts={accounts}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            load()
          }}
        />
      )}
      {adjusting && (
        <AdjustingForm
          accounts={accounts}
          onClose={() => setAdjusting(false)}
          onSaved={() => setAdjusting(false)}
        />
      )}
    </div>
  )
}

function AdjustingForm({
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
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await BankAdjusting.create({ ...form, amount: Number(form.amount) })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Failed — check Account Mapping settings')
      return
    }
    alert('Adjusting journal entry posted to GL.')
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Adjusting Entry</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
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
      </div>
    </div>
  )
}

function ReconForm({
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
    statementDate: new Date().toISOString().slice(0, 10),
    statementBalance: '',
    systemBalance: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await BankAccounts.createReconciliation({
      ...form,
      statementBalance: Number(form.statementBalance),
      systemBalance: Number(form.systemBalance),
    })
    setSaving(false)
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">New Reconciliation</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
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
            <span className="block text-xs font-medium text-gray-600 mb-1">Statement Date *</span>
            <input
              required
              type="date"
              value={form.statementDate}
              onChange={(e) => setForm({ ...form, statementDate: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">
                Statement Balance *
              </span>
              <input
                required
                type="number"
                step="0.01"
                value={form.statementBalance}
                onChange={(e) => setForm({ ...form, statementBalance: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">System Balance *</span>
              <input
                required
                type="number"
                step="0.01"
                value={form.systemBalance}
                onChange={(e) => setForm({ ...form, systemBalance: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </label>
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
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
