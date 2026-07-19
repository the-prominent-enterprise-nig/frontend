'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Wallet, Calculator } from 'lucide-react'
import { installmentAccountsApi, collectorsApi } from '@/src/libs/api/crm'
import { getBranches } from '../_actions/get-branches'
import PriceCheckModal from '@/src/components/crm/PriceCheckModal'
import type { InstallmentAccount } from '@/src/schema/crm/types'

const CATEGORY_COLORS: Record<string, string> = {
  A: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  B: 'bg-blue-50 text-blue-700 ring-blue-200',
  C: 'bg-amber-50 text-amber-700 ring-amber-200',
  D: 'bg-red-50 text-red-700 ring-red-200',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-50 text-blue-700 ring-blue-200',
  closed: 'bg-gray-100 text-gray-600 ring-gray-200',
  early_closed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  written_off: 'bg-red-50 text-red-700 ring-red-200',
}

function CategoryBadge({ category }: { category?: string | null }) {
  if (!category) return <span className="text-gray-400">—</span>
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        CATEGORY_COLORS[category] ?? 'bg-gray-100 text-gray-600 ring-gray-200'
      }`}
    >
      {category}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600 ring-gray-200'
      }`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

function peso(amount: number | string): string {
  return `₱${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export default function InstallmentAccountsList({ canCreate }: { canCreate: boolean }) {
  const [accounts, setAccounts] = useState<InstallmentAccount[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [collectors, setCollectors] = useState<{ id: string; name: string; stubNumber: string }[]>(
    []
  )
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [classificationFilter, setClassificationFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [collectorFilter, setCollectorFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [priceCheckOpen, setPriceCheckOpen] = useState(false)

  useEffect(() => {
    getBranches().then((res) => {
      if (res.success && res.data) setBranches(res.data.data)
    })
    collectorsApi.list({ limit: 200 }).then((res) => {
      if (res.success && res.data) setCollectors(res.data.data)
    })
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      const res = await installmentAccountsApi.list({
        search: search || undefined,
        category: categoryFilter || undefined,
        classification: classificationFilter || undefined,
        status: statusFilter || undefined,
        branchId: branchFilter || undefined,
        collectorId: collectorFilter || undefined,
        limit: 50,
      })
      if (controller.signal.aborted) return
      if (res.success && res.data) setAccounts(res.data.data)
      else setError(res.error ?? 'Failed to load installment accounts')
      setLoading(false)
    }, 250)
    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [search, categoryFilter, classificationFilter, statusFilter, branchFilter, collectorFilter])

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Installment Accounts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Financing accounts, balances, categories, and aging.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <button
            onClick={() => setPriceCheckOpen(true)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:flex-none"
          >
            <Calculator className="h-4 w-4" />
            Price checker
          </button>
          {canCreate && (
            <Link
              href="/crm/installment-accounts/new"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-prominent-orange-700 sm:flex-none"
            >
              <Plus className="h-4 w-4" />
              New account
            </Link>
          )}
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search account number…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-prominent-orange-400 focus:outline-none"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          <option value="A">A</option>
          <option value="B">B</option>
          <option value="C">C</option>
          <option value="D">D</option>
        </select>
        <select
          value={classificationFilter}
          onChange={(e) => setClassificationFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All classifications</option>
          <option value="official">Official</option>
          <option value="arrears">Arrears</option>
          <option value="not_moving">Not moving</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="early_closed">Early closed</option>
          <option value="written_off">Written off</option>
        </select>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={collectorFilter}
          onChange={(e) => setCollectorFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">All collectors</option>
          {collectors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.stubNumber} — {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-gray-400">
          Loading…
        </div>
      )}
      {!loading && error && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-red-500">
          {error}
        </div>
      )}
      {!loading && !error && accounts.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-gray-400">
          No installment accounts match these filters yet.
        </div>
      )}

      {!loading && !error && accounts.length > 0 && (
        <>
          {/* Mobile: card list */}
          <ul className="space-y-3 md:hidden">
            {accounts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/crm/installment-accounts/${a.id}`}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm active:bg-gray-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-prominent-orange-100 text-prominent-orange-700">
                    <Wallet className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-gray-900">{a.accountNumber}</span>
                      <CategoryBadge category={a.category} />
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-gray-500">
                      {a.customer ? a.customer.name : '—'}
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <StatusBadge status={a.status} />
                      <span className="text-[13px] font-semibold tabular-nums text-gray-900">
                        {peso(a.currentBalance)}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Account #</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Collector</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Aging</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {accounts.map((a) => (
                    <tr key={a.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <Link
                          href={`/crm/installment-accounts/${a.id}`}
                          className="hover:text-prominent-orange-700 hover:underline"
                        >
                          {a.accountNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-700">
                        {a.customer ? a.customer.name : '—'}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">
                        {a.branch?.name ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">
                        {a.collector?.stubNumber ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={a.category} />
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">
                        {a.agingBucket ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                        {peso(a.currentBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {priceCheckOpen && <PriceCheckModal onClose={() => setPriceCheckOpen(false)} />}
    </div>
  )
}
