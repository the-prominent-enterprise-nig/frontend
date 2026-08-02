'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, Trash2, CreditCard } from 'lucide-react'
import { APPaymentMethods, type APPaymentMethodConfig } from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'

// Scenario 10 (Purchasing & AP) Part 3 — configures how suppliers get paid
// (method) and which GL account each maps to. Distinct from the POS-side
// tender-config system (PosPaymentMethodConfig) — this is AP-only.
export default function APPaymentMethodsPanel() {
  const [methods, setMethods] = useState<APPaymentMethodConfig[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', label: '', glAccountId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [m, a] = await Promise.all([APPaymentMethods.list(), getAccounts({ limit: 500 })])
    setMethods(m.data ?? [])
    const d = a.data as any
    setAccounts(d?.items ?? d ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await APPaymentMethods.create({
      name: form.name,
      label: form.label,
      glAccountId: form.glAccountId || undefined,
    })
    setSaving(false)
    if (!res.success) {
      setError(res.message || res.error || 'Save failed')
      return
    }
    setForm({ name: '', label: '', glAccountId: '' })
    setAdding(false)
    load()
  }

  const setGlAccount = async (id: string, glAccountId: string) => {
    await APPaymentMethods.update(id, { glAccountId: glAccountId || undefined })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Disable this payment method?')) return
    await APPaymentMethods.remove(id)
    load()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">AP Payment Methods</h2>
          <p className="text-sm text-gray-500">
            How suppliers get paid, and which GL account each method credits when recording a
            payment.
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
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Method
          </button>
        </div>
      </div>

      {adding && (
        <form
          onSubmit={submit}
          className="mb-4 bg-white border border-gray-200 rounded-lg p-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Name *</span>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Check, Bank Transfer"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Label *</span>
              <input
                required
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Short label shown in the payment form"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">GL Account</span>
            <select
              value={form.glAccountId}
              onChange={(e) => setForm({ ...form, glAccountId: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">— Falls back to Default Cash —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code ?? a.number} — {a.name}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
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
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-left">Label</th>
              <th className="px-3 py-2 text-left">GL Account</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : methods.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <CreditCard className="w-8 h-8 text-gray-300" />
                    No payment methods configured yet — payments fall back to Default Cash.
                  </div>
                </td>
              </tr>
            ) : (
              methods.map((m) => (
                <tr key={m.id}>
                  <td className="px-3 py-2 font-medium">{m.name}</td>
                  <td className="px-3 py-2 text-gray-600">{m.label}</td>
                  <td className="px-3 py-2">
                    <select
                      value={m.glAccountId ?? ''}
                      onChange={(e) => setGlAccount(m.id, e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-200 rounded-lg"
                    >
                      <option value="">— Falls back to Default Cash —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code ?? a.number} — {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        m.isEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {m.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {m.isEnabled && (
                      <button
                        onClick={() => remove(m.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
