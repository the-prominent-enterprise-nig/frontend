'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search, X, ChevronRight, ChevronDown } from 'lucide-react'
import { RowActionsMenu } from '@/src/components/ui/RowActionsMenu'
import { type SessionUser } from '@/src/libs/guards/permission'
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  type Account,
} from '@/src/libs/data/AccountingData'

const TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']
const CATEGORIES = [
  'CASH',
  'ACCOUNTS_RECEIVABLE',
  'INVENTORY',
  'PREPAID_EXPENSES',
  'PROPERTY_PLANT_EQUIPMENT',
  'ACCUMULATED_DEPRECIATION',
  'ACCOUNTS_PAYABLE',
  'SHORT_TERM_DEBT',
  'LONG_TERM_DEBT',
  'SHARE_CAPITAL',
  'RETAINED_EARNINGS',
  'REVENUE',
  'COGS',
  'OPERATING_EXPENSE',
  'ADMINISTRATIVE_EXPENSE',
  'FINANCIAL_EXPENSE',
]

export function ChartOfAccountsList(_props: { session: SessionUser | null }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [editing, setEditing] = useState<Account | null>(null)
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getAccounts({
      search: search || undefined,
      type: typeFilter || undefined,
      limit: 1000,
    })
    if (res.success && res.data) {
      const items = Array.isArray(res.data) ? res.data : ((res.data as any).items ?? [])
      setAccounts(items as Account[])
    }
    setLoading(false)
  }, [search, typeFilter])
  useEffect(() => {
    load()
  }, [load])

  const del = async (id: string) => {
    if (confirm('Delete account?')) {
      await deleteAccount(id)
      load()
    }
  }
  // With no search/type filter the list is a tree: parents expand to show the
  // accounts filed beneath them. A filter flattens it so matches are never hidden.
  const flat = !!search || !!typeFilter
  const ids = new Set(accounts.map((a: any) => a.id))
  const kidsOf = (id: string) => accounts.filter((a: any) => a.parentAccountId === id)
  const toggle = (id: string) =>
    setOpen((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const rows: { a: any; depth: number; kids: number }[] = []
  const walk = (a: any, depth: number) => {
    const kids = kidsOf(a.id)
    rows.push({ a, depth, kids: kids.length })
    if (open.has(a.id)) kids.forEach((k) => walk(k, depth + 1))
  }
  if (flat) accounts.forEach((a: any) => rows.push({ a, depth: 0, kids: 0 }))
  else
    accounts
      .filter((a: any) => !a.parentAccountId || !ids.has(a.parentAccountId))
      .forEach((a: any) => walk(a, 0))
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Chart of Accounts</h2>
          <p className="text-sm text-gray-500">All accounts used to categorize transactions.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Account
          </button>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
        >
          <option value="">All Types</option>
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Number</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 w-10" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                  No accounts.
                </td>
              </tr>
            ) : (
              rows.map(({ a, depth, kids }) => (
                <tr
                  key={a.id}
                  className={kids ? 'cursor-pointer hover:bg-gray-50' : undefined}
                  onClick={kids ? () => toggle(a.id) : undefined}
                >
                  <td className="px-3 py-2 font-mono text-xs">{a.number ?? a.code}</td>
                  <td className="px-3 py-2 font-medium">
                    <span
                      className="inline-flex items-center gap-1"
                      style={{ paddingLeft: depth * 20 }}
                    >
                      {kids ? (
                        open.has(a.id) ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )
                      ) : (
                        <span className="w-4" />
                      )}
                      {a.name}
                      {kids > 0 && (
                        <span className="text-xs font-normal text-gray-400">({kids})</span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{a.type}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{a.category || '—'}</td>
                  <td className="px-3 py-2 text-right">{a.balance ?? 0}</td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <RowActionsMenu
                      items={[
                        { label: 'Edit', icon: Pencil, onClick: () => setEditing(a) },
                        {
                          label: 'Delete',
                          icon: Trash2,
                          variant: 'danger',
                          onClick: () => del(a.id),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {(creating || editing) && (
        <AccountForm
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

function AccountForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: any | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    number: initial?.number ?? initial?.code ?? '',
    type: initial?.type ?? 'ASSET',
    category: initial?.category ?? '',
    description: initial?.description ?? '',
  })
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload: any = {
      name: form.name,
      number: form.number,
      type: form.type,
      description: form.description,
    }
    if (form.category) payload.category = form.category
    if (initial) await updateAccount(initial.id, payload)
    else await createAccount(payload)
    setSaving(false)
    onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">{initial ? 'Edit Account' : 'New Account'}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Number *</span>
              <input
                required
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
                placeholder="1000-001"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Type *</span>
              <select
                required
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
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
            <span className="block text-xs font-medium text-gray-600 mb-1">Category</span>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              <option value="">(none)</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-600 mb-1">Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
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
