'use client'
import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, Pencil, Trash2, X } from 'lucide-react'
import { BankAccounts, type BankAccount, fmtMoney } from '@/src/libs/data/AccountingV2Data'

export default function BankAccountsList() {
  const [items, setItems] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<BankAccount | null>(null)
  const [creating, setCreating] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    const r = await BankAccounts.list()
    setItems(r.data ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])
  const del = async (id: string) => {
    if (confirm('Deactivate account?')) {
      await BankAccounts.remove(id)
      load()
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Bank Accounts</h2>
          <p className="text-sm text-gray-500">Operating, payroll, and savings accounts.</p>
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
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Bank</th>
              <th className="px-3 py-2 text-left">Account #</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Currency</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  No bank accounts.
                </td>
              </tr>
            ) : (
              items.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-medium">{a.name}</td>
                  <td className="px-3 py-2">{a.bankName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{a.accountNumber}</td>
                  <td className="px-3 py-2 text-xs">{a.accountType}</td>
                  <td className="px-3 py-2 text-xs">{a.currencyCode}</td>
                  <td className="px-3 py-2 text-right">{fmtMoney(a.currentBalance)}</td>
                  <td className="px-3 py-2 text-xs">
                    {a.isActive ? (
                      <span className="text-emerald-700">Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setEditing(a)}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => del(a.id)}
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
      {(creating || editing) && (
        <BankForm
          initial={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function BankForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: BankAccount | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    bankName: initial?.bankName ?? '',
    accountNumber: initial?.accountNumber ?? '',
    accountType: initial?.accountType ?? 'Operating',
    currencyCode: initial?.currencyCode ?? 'PHP',
    currentBalance: String(initial?.currentBalance ?? 0),
  })
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, currentBalance: Number(form.currentBalance) }
    if (initial) await BankAccounts.update(initial.id, payload)
    else await BankAccounts.create(payload)
    setSaving(false)
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">
            {initial ? 'Edit Bank Account' : 'New Bank Account'}
          </h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <F label="Name *">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
          <F label="Bank *">
            <input
              required
              value={form.bankName}
              onChange={(e) => setForm({ ...form, bankName: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
          <F label="Account Number *">
            <input
              required
              value={form.accountNumber}
              onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            />
          </F>
          <div className="grid grid-cols-3 gap-3">
            <F label="Type">
              <select
                value={form.accountType}
                onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                <option>Operating</option>
                <option>Payroll</option>
                <option>Savings</option>
              </select>
            </F>
            <F label="Currency">
              <input
                value={form.currencyCode}
                onChange={(e) => setForm({ ...form, currencyCode: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </F>
            <F label="Current Balance">
              <input
                type="number"
                step="0.01"
                value={form.currentBalance}
                onChange={(e) => setForm({ ...form, currentBalance: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </F>
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
function F({ label, children }: { label: string; children: any }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
