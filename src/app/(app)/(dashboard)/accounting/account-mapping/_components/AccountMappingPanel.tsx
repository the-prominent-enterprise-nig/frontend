'use client'

import { useCallback, useEffect, useState } from 'react'
import { Save, RefreshCw, Sparkles } from 'lucide-react'
import { AccountMappings, COASeed, type AccountMapping } from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'

export default function AccountMappingPanel() {
  const [mappings, setMappings] = useState<AccountMapping[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [m, a] = await Promise.all([AccountMappings.list(), getAccounts({ limit: 500 })])
    setMappings(m.data ?? [])
    const d = a.data as any
    setAccounts(d?.items ?? d ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const setAcc = (key: string, accountId: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.key === key ? { ...m, accountId: accountId || null } : m))
    )
  }

  const save = async () => {
    setSaving(true)
    setMsg(null)
    const payload = mappings.map((m) => ({ key: m.key, accountId: m.accountId ?? null }))
    const res = await AccountMappings.setBulk(payload)
    setSaving(false)
    if (res.success) setMsg({ kind: 'ok', text: 'Account mappings saved.' })
    else setMsg({ kind: 'err', text: res.message || 'Save failed' })
  }

  const seedPH = async () => {
    if (
      !confirm(
        'This will create the standard PH chart of accounts and auto-configure account mappings. Continue?'
      )
    )
      return
    setSeeding(true)
    setMsg(null)
    const res = await COASeed.seedPH()
    setSeeding(false)
    if (res.success && res.data) {
      setMsg({
        kind: 'ok',
        text: `Created ${res.data.created} accounts, skipped ${res.data.skipped} existing. ${res.data.mappingsConfigured} mappings configured.`,
      })
      load()
    } else {
      setMsg({ kind: 'err', text: res.message || 'Seed failed' })
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Account Mapping</h2>
          <p className="text-sm text-gray-500">
            Configure which accounts the system uses for AR, AP, taxes, bank charges, etc. Required
            for auto-posting.
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
            onClick={seedPH}
            disabled={seeding}
            className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" /> {seeding ? 'Seeding...' : 'Seed PH Defaults'}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${msg.kind === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
        >
          {msg.text}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Mapping</th>
              <th className="px-3 py-2 text-left">Purpose</th>
              <th className="px-3 py-2 text-left">Account</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : (
              mappings.map((m) => (
                <tr key={m.key}>
                  <td className="px-3 py-2 font-medium">
                    {m.label}
                    <div className="text-xs text-gray-400 font-mono">{m.key}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 max-w-sm">{m.description}</td>
                  <td className="px-3 py-2">
                    <select
                      value={m.accountId ?? ''}
                      onChange={(e) => setAcc(m.key, e.target.value)}
                      className={`w-full px-2 py-1.5 text-sm border rounded ${m.accountId ? 'border-gray-200' : 'border-amber-300 bg-amber-50'}`}
                    >
                      <option value="">— Not configured —</option>
                      {accounts.map((a: any) => (
                        <option key={a.id} value={a.id}>
                          {a.number ?? a.code} — {a.name}
                        </option>
                      ))}
                    </select>
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
