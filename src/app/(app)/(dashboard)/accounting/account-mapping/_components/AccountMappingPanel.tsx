'use client'

import { useCallback, useEffect, useState } from 'react'
import { Save, RefreshCw, Sparkles } from 'lucide-react'
import { AccountMappings, COASeed, type AccountMapping } from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account, type AccountType } from '@/src/libs/data/AccountingData'

/**
 * Mapping keys that cleanly represent one transaction's debit + credit side
 * (confirmed from each key's own description in the backend's
 * account-mapping.service.ts, e.g. AR_RECEIVABLE "Debited when..." /
 * SALES_REVENUE "Credited when..." — same event). A handful of mappings
 * (VAT, WHT, bank charges, POS tender types, etc.) don't cleanly pair to a
 * single counterpart — those stay in the flat list below, unchanged.
 */
const PAIRED_MAPPINGS: { title: string; debitKey: string; creditKey: string; note?: string }[] = [
  {
    title: 'AR Invoice Posted',
    debitKey: 'AR_RECEIVABLE',
    creditKey: 'SALES_REVENUE',
    note: 'Output VAT is also credited on the same entry — configured separately below.',
  },
  {
    title: 'Credit Memo — Sales Return',
    debitKey: 'SALES_RETURNS_ALLOWANCES',
    creditKey: 'AR_RECEIVABLE',
    note: 'Billing Adjustment / Goodwill credit memos debit Default Sales Revenue instead — see AR Invoice Posted above.',
  },
  {
    title: 'AP Invoice Received',
    debitKey: 'DEFAULT_EXPENSE',
    creditKey: 'AP_PAYABLE',
    note: 'Input VAT is also debited on the same entry — configured separately below.',
  },
  {
    title: 'Repair Assessed',
    debitKey: 'REPAIR_EXPENSE',
    creditKey: 'REPAIR_PROVIDER_PAYABLE',
  },
  {
    title: 'Session Close (Cash Sweep)',
    debitKey: 'CASH_IN_TRANSIT',
    creditKey: 'POS_UNDEPOSITED_FUNDS',
    note: 'Same Undeposited Funds account is also debited at sale time — see POS — Undeposited Funds below.',
  },
  {
    title: 'Cost of Goods Sold',
    debitKey: 'COGS_EXPENSE',
    creditKey: 'INVENTORY_ASSET',
    note: 'Inventory Asset is also debited on receiving — see Default Inventory Asset below.',
  },
]

// The backend's Account model has no normalBalance field at all — derive it
// from `type` instead, per standard accounting rule: Assets and Expenses are
// normally debit-balance; Liabilities, Equity, and Revenue are normally
// credit-balance.
const DEBIT_NORMAL_TYPES = new Set<AccountType>(['ASSET', 'EXPENSE'])

function normalBalanceBadge(account: Account | undefined) {
  if (!account) return null
  const isDebit = DEBIT_NORMAL_TYPES.has(account.type)
  return (
    <span
      className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        isDebit ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
      }`}
    >
      {isDebit ? 'Debit' : 'Credit'}
    </span>
  )
}

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

  const mappingByKey = new Map(mappings.map((m) => [m.key, m]))
  const accountById = new Map(accounts.map((a) => [a.id, a]))
  const pairedKeys = new Set(PAIRED_MAPPINGS.flatMap((p) => [p.debitKey, p.creditKey]))
  const otherMappings = mappings.filter((m) => !pairedKeys.has(m.key))

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
        "This will create NIG's real chart of accounts (~155 Revenue/Cost of Sales/Expense accounts) and auto-configure the account mappings we have real matches for. Continue?"
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
            <Sparkles className="w-4 h-4" /> {seeding ? 'Seeding...' : 'Seed NIG Accounts'}
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

      {!loading && (
        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">
            Paired mappings — debit and credit side, same transaction
          </h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Transaction</th>
                  <th className="px-3 py-2 text-left">Debit Account</th>
                  <th className="px-3 py-2 text-left">Credit Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {PAIRED_MAPPINGS.map((pair) => {
                  const debitMapping = mappingByKey.get(pair.debitKey)
                  const creditMapping = mappingByKey.get(pair.creditKey)
                  if (!debitMapping || !creditMapping) return null
                  const debitAccount = accountById.get(debitMapping.accountId ?? '')
                  const creditAccount = accountById.get(creditMapping.accountId ?? '')
                  return (
                    <tr key={pair.title}>
                      <td className="px-3 py-2 align-top font-medium">
                        {pair.title}
                        {pair.note && (
                          <div className="mt-0.5 max-w-xs text-xs font-normal text-gray-400">
                            {pair.note}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={debitMapping.accountId ?? ''}
                          onChange={(e) => setAcc(pair.debitKey, e.target.value)}
                          className={`w-full px-2 py-1.5 text-sm border rounded ${debitMapping.accountId ? 'border-gray-200' : 'border-amber-300 bg-amber-50'}`}
                        >
                          <option value="">— Not configured —</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.number ?? a.code} — {a.name}
                            </option>
                          ))}
                        </select>
                        {normalBalanceBadge(debitAccount)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={creditMapping.accountId ?? ''}
                          onChange={(e) => setAcc(pair.creditKey, e.target.value)}
                          className={`w-full px-2 py-1.5 text-sm border rounded ${creditMapping.accountId ? 'border-gray-200' : 'border-amber-300 bg-amber-50'}`}
                        >
                          <option value="">— Not configured —</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.number ?? a.code} — {a.name}
                            </option>
                          ))}
                        </select>
                        {normalBalanceBadge(creditAccount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h3 className="mb-2 text-sm font-semibold text-gray-700">Other mappings</h3>
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
              otherMappings.map((m) => (
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
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.number ?? a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                    {normalBalanceBadge(accountById.get(m.accountId ?? ''))}
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
