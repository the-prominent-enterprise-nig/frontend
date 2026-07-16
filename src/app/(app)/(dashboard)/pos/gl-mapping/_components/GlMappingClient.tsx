'use client'

import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, Save, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react'
import {
  getAccountMappings,
  bulkUpdateAccountMappings,
  getGLAccounts,
  type AccountMapping,
  type GLAccount,
} from '../../_actions/pos-actions'

const POS_KEYS = [
  'POS_CASH',
  'POS_CARD',
  'POS_EWALLET',
  'POS_GIFT_CARD',
  'POS_BANK_TRANSFER',
  'POS_LOYALTY_POINTS',
  'POS_STORE_CREDIT',
]

export default function GlMappingClient() {
  const [mappings, setMappings] = useState<AccountMapping[]>([])
  const [accounts, setAccounts] = useState<GLAccount[]>([])
  const [draft, setDraft] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const [mRes, aRes] = await Promise.all([getAccountMappings(), getGLAccounts()])
    if (!mRes.success) {
      setError(mRes.error ?? 'Failed to load mappings')
      setLoading(false)
      return
    }
    if (!aRes.success) {
      setError(aRes.error ?? 'Failed to load accounts')
      setLoading(false)
      return
    }
    const pos = (mRes.data ?? []).filter((m) => POS_KEYS.includes(m.key))
    setMappings(pos)
    setDraft(Object.fromEntries(pos.map((m) => [m.key, m.accountId])))
    setAccounts(aRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const isDirty = useMemo(
    () => mappings.some((m) => draft[m.key] !== m.accountId),
    [mappings, draft]
  )

  const unconfigured = mappings.filter((m) => !draft[m.key]).length

  async function handleSave() {
    setSaving(true)
    setError('')
    const res = await bulkUpdateAccountMappings(
      Object.entries(draft).map(([key, accountId]) => ({ key, accountId }))
    )
    setSaving(false)
    if (!res.success) {
      setError(res.error ?? 'Failed to save')
      return
    }
    // Refresh to confirm saved state
    const mRes = await getAccountMappings()
    if (mRes.success) {
      const pos = (mRes.data ?? []).filter((m) => POS_KEYS.includes(m.key))
      setMappings(pos)
      setDraft(Object.fromEntries(pos.map((m) => [m.key, m.accountId])))
    }
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 3000)
  }

  const accountOptions = useMemo(
    () =>
      [...accounts].sort((a, b) =>
        (a.number ?? a.code ?? '').localeCompare(b.number ?? b.code ?? '')
      ),
    [accounts]
  )

  return (
    <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">POS GL Account Mapping</h1>
            <p className="mt-1 text-sm text-gray-500">
              Map each POS payment method to its debit account in the general ledger. These accounts
              are debited when a sale is posted.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {unconfigured > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-700">
              <span className="font-semibold">
                {unconfigured} payment method{unconfigured > 1 ? 's' : ''} not mapped.
              </span>{' '}
              Transactions using an unmapped method will be rejected at checkout until this is
              configured.
            </p>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4">
                  <div className="h-4 w-1/4 rounded bg-gray-200" />
                  <div className="h-4 w-2/5 rounded bg-gray-200" />
                  <div className="h-8 flex-1 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Payment Method
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Description
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500 w-72">
                    GL Account (Debit)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mappings.map((m) => {
                  const mapped = !!draft[m.key]
                  return (
                    <tr key={m.key} className={!mapped ? 'bg-amber-50/40' : undefined}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {!mapped && (
                            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                          )}
                          <span className="font-medium text-gray-900">{m.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{m.description}</td>
                      <td className="px-5 py-3">
                        <div className="relative">
                          <select
                            className="select text-xs"
                            value={draft[m.key] ?? ''}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                [m.key]: e.target.value || null,
                              }))
                            }
                          >
                            <option value="">— Not configured —</option>
                            {accountOptions.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.number ?? a.code} · {a.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={12}
                            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400">
            {isDirty ? (
              <span className="text-amber-600 font-medium">Unsaved changes</span>
            ) : saveSuccess ? (
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <CheckCircle2 size={12} /> Saved
              </span>
            ) : (
              'All changes saved'
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !isDirty || loading}
            className="flex items-center gap-2 rounded-xl bg-purple-700 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-purple-800 disabled:opacity-40"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Mappings'}
          </button>
        </div>
      </div>
    </div>
  )
}
