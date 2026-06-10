'use client'
import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, Play, Trash2, X } from 'lucide-react'
import { RecurringEntries, type RecurringEntry, fmtDate } from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'

const FREQS = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']

export default function RecurringList() {
  const [items, setItems] = useState<RecurringEntry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await RecurringEntries.list()
    setItems(r.data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
    getAccounts({ limit: 500 }).then((r) => {
      const d = r.data as any
      setAccounts(d?.items ?? d ?? [])
    })
  }, [load])
  const del = async (id: string) => {
    if (confirm('Deactivate?')) {
      await RecurringEntries.remove(id)
      load()
    }
  }
  const run = async (id: string) => {
    await RecurringEntries.runNow(id)
    alert('Journal entry created (DRAFT). Check Journal Entries.')
    load()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Recurring Entries</h2>
          <p className="text-sm text-gray-500">
            Auto-generated journal entries (rent, depreciation, etc.).
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New
          </button>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Frequency</th>
              <th className="px-3 py-2 text-left">Next Run</th>
              <th className="px-3 py-2 text-left">Last Run</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  No recurring entries.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-xs">{r.frequency}</td>
                  <td className="px-3 py-2 text-xs">{fmtDate(r.nextRunDate)}</td>
                  <td className="px-3 py-2 text-xs">{r.lastRunAt ? fmtDate(r.lastRunAt) : '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.isActive ? (
                      <span className="text-emerald-700">Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => run(r.id)}
                        title="Run now"
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => del(r.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {creating && (
        <RecForm
          accounts={accounts}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function RecForm({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: Account[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    frequency: 'MONTHLY',
    startDate: new Date().toISOString().slice(0, 10),
    nextRunDate: new Date().toISOString().slice(0, 10),
  })
  const [lines, setLines] = useState([
    { accountId: '', debit: '', credit: '', description: '' },
    { accountId: '', debit: '', credit: '', description: '' },
  ])
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const template = {
      transactions: lines
        .filter((l) => l.accountId)
        .map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description,
        })),
    }
    await RecurringEntries.create({ ...form, template })
    setSaving(false)
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">New Recurring Entry</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Name *</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Frequency *</span>
              <select
                required
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                {FREQS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Start Date *</span>
              <input
                required
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Next Run *</span>
              <input
                required
                type="date"
                value={form.nextRunDate}
                onChange={(e) => setForm({ ...form, nextRunDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Transaction Template</label>
              <button
                type="button"
                onClick={() =>
                  setLines([...lines, { accountId: '', debit: '', credit: '', description: '' }])
                }
                className="text-xs text-purple-700"
              >
                + Add line
              </button>
            </div>
            <div className="border border-gray-200 rounded-lg p-2 space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <select
                    value={l.accountId}
                    onChange={(e) => {
                      const n = [...lines]
                      n[i].accountId = e.target.value
                      setLines(n)
                    }}
                    className="col-span-5 px-2 py-1.5 text-sm border border-gray-200 rounded"
                  >
                    <option value="">— Account —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {(a as any).number ?? a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Debit"
                    value={l.debit}
                    onChange={(e) => {
                      const n = [...lines]
                      n[i].debit = e.target.value
                      setLines(n)
                    }}
                    className="col-span-3 px-2 py-1.5 text-sm border border-gray-200 rounded text-right"
                  />
                  <input
                    type="number"
                    placeholder="Credit"
                    value={l.credit}
                    onChange={(e) => {
                      const n = [...lines]
                      n[i].credit = e.target.value
                      setLines(n)
                    }}
                    className="col-span-3 px-2 py-1.5 text-sm border border-gray-200 rounded text-right"
                  />
                  <button
                    type="button"
                    onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                    className="col-span-1 text-red-500"
                  >
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              ))}
            </div>
          </div>
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
