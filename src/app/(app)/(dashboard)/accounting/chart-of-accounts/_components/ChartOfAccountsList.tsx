'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Search, ChevronRight, ChevronDown } from 'lucide-react'
import { RowActionsMenu } from '@/src/components/ui/RowActionsMenu'
import { type SessionUser } from '@/src/libs/guards/permission'
import { getAccounts, deleteAccount, type Account } from '@/src/libs/data/AccountingData'
import {
  ACCOUNT_CLASSES,
  accountClassLabel,
  cashFlowClassLabel,
  categoryLabel,
} from '@/src/libs/accounting/account-classification'

export function ChartOfAccountsList(_props: { session: SessionUser | null }) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState<string>('')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getAccounts({
      search: search || undefined,
      accountClass: classFilter || undefined,
      limit: 1000,
    })
    if (res.success && res.data) {
      const items = Array.isArray(res.data) ? res.data : ((res.data as any).items ?? [])
      setAccounts(items as Account[])
    }
    setLoading(false)
  }, [search, classFilter])
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
  const flat = !!search || !!classFilter
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
    <div className="px-6 py-5 lg:px-10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-prominent-purple-900">Chart of Accounts</h2>
          <p className="text-sm text-gray-500">All accounts used to categorize transactions.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/accounting/chart-of-accounts/new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Account
          </Link>
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
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          aria-label="Account type"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg"
        >
          <option value="">All Types</option>
          {ACCOUNT_CLASSES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
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
              <th className="px-3 py-2 text-left">Cash Flow</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 w-10" aria-label="Actions" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
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
                  <td className="px-3 py-2 text-xs">
                    {a.accountClass ? accountClassLabel(a.accountClass) : a.type}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{categoryLabel(a.category)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {cashFlowClassLabel(a.cashFlowClass)}
                  </td>
                  <td className="px-3 py-2 text-right">{a.balance ?? 0}</td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <RowActionsMenu
                      items={[
                        {
                          label: 'Edit',
                          icon: Pencil,
                          onClick: () => router.push(`/accounting/chart-of-accounts/${a.id}/edit`),
                        },
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
    </div>
  )
}
