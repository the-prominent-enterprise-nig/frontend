'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  Wallet,
  Calculator,
  FileClock,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react'
import { installmentAccountsApi, collectorsApi } from '@/src/libs/api/crm'
import { getBranches } from '../_actions/get-branches'
import PriceCheckModal from '@/src/components/crm/PriceCheckModal'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import TablePagination from '@/src/components/common/TablePagination'
import type { InstallmentAccount } from '@/src/schema/crm/types'
import { XDealBadge } from '@/src/components/pos/XDealBadge'

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

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** A due date already behind us on an account that is still being collected. */
function isPastDue(dueDate: string | null | undefined): boolean {
  return !!dueDate && new Date(dueDate).getTime() < Date.now()
}

const FILTER_CLASS = 'rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm'

const CATEGORY_OPTIONS = ['A', 'B', 'C', 'D'].map((c) => ({ value: c, label: c }))

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'early_closed', label: 'Early closed' },
  { value: 'written_off', label: 'Written off' },
]

// Scenario 79 — client: "max 20 per page" (the API caps it there too).
const PAGE_SIZE = 20

/** '' = newest accounts first (the API's default); otherwise by the Due Date column. */
type DueSort = '' | 'asc' | 'desc'

const SORT_OPTIONS = [
  // Worded for collections (Kian, 2026-10-28): ascending puts the oldest unpaid
  // due — the most overdue account — on top.
  { value: 'asc', label: 'Past Due' },
  { value: 'desc', label: 'Upcoming Due' },
]

export default function InstallmentAccountsList({ canCreate }: { canCreate: boolean }) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<InstallmentAccount[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [collectors, setCollectors] = useState<{ id: string; name: string; stubNumber: string }[]>(
    []
  )
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [collectorFilter, setCollectorFilter] = useState('')
  const [dueFrom, setDueFrom] = useState('')
  const [dueTo, setDueTo] = useState('')
  const [dueSort, setDueSort] = useState<DueSort>('')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
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
        status: statusFilter || undefined,
        branchId: branchFilter || undefined,
        collectorId: collectorFilter || undefined,
        dueFrom: dueFrom || undefined,
        dueTo: dueTo || undefined,
        ...(dueSort && { sortBy: 'dueDate' as const, sortOrder: dueSort }),
        page,
        limit: PAGE_SIZE,
      })
      if (controller.signal.aborted) return
      if (res.success && res.data) {
        setAccounts(res.data.data)
        setMeta({ total: res.data.meta.total, lastPage: res.data.meta.lastPage })
      } else setError(res.error ?? 'Failed to load installment accounts')
      setLoading(false)
    }, 250)
    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [
    search,
    categoryFilter,
    statusFilter,
    branchFilter,
    collectorFilter,
    dueFrom,
    dueTo,
    dueSort,
    page,
  ])

  // A new search, filter or sort starts back on page 1 — the page it was on
  // may not exist in the new result, or hold different accounts.
  const resetting =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setPage(1)
    }

  // The Due Date header cycles past due → upcoming due →
  // back to the default order (newest accounts).
  const cycleDueSort = () =>
    resetting(setDueSort)(dueSort === '' ? 'asc' : dueSort === 'asc' ? 'desc' : '')

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Installment Accounts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Financing accounts, balances, and categories.
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
          <Link
            href="/crm/installment-accounts/aging-report"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:flex-none"
          >
            <FileClock className="h-4 w-4" />
            AR Aging Report
          </Link>
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

      {/* Search on its own row, every filter on the row below it, in the
          order the client drew them: Category, Branch, Collector Code, Due
          Date From–To, Status. Every dropdown is searchable. */}
      <div className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => resetting(setSearch)(e.target.value)}
            placeholder="Search account number…"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-prominent-orange-400 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchableSelect
            value={categoryFilter}
            onChange={resetting(setCategoryFilter)}
            options={CATEGORY_OPTIONS}
            placeholder="All categories"
            clearable
            portal
            className="min-w-[9.5rem] flex-1"
          />
          <SearchableSelect
            value={branchFilter}
            onChange={resetting(setBranchFilter)}
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
            placeholder="All branches"
            clearable
            portal
            className="min-w-[9rem] flex-1"
          />
          <SearchableSelect
            value={collectorFilter}
            onChange={resetting(setCollectorFilter)}
            options={collectors.map((c) => ({ value: c.id, label: `${c.stubNumber} — ${c.name}` }))}
            placeholder="All collector codes"
            clearable
            portal
            className="min-w-[11rem] flex-[1.5]"
          />
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">Due Date</span>
            <input
              type="date"
              aria-label="Due Date from"
              value={dueFrom}
              max={dueTo || undefined}
              onChange={(e) => resetting(setDueFrom)(e.target.value)}
              className={`${FILTER_CLASS} w-[8.75rem] shrink-0 !px-2 text-[13px]`}
            />
            <span>to</span>
            <input
              type="date"
              aria-label="Due Date to"
              value={dueTo}
              min={dueFrom || undefined}
              onChange={(e) => resetting(setDueTo)(e.target.value)}
              className={`${FILTER_CLASS} w-[8.75rem] shrink-0 !px-2 text-[13px]`}
            />
          </div>
          <SearchableSelect
            value={statusFilter}
            onChange={resetting(setStatusFilter)}
            options={STATUS_OPTIONS}
            placeholder="All statuses"
            clearable
            portal
            className="min-w-[9rem] flex-1"
          />
          <SearchableSelect
            value={dueSort}
            onChange={(v) => resetting(setDueSort)(v as DueSort)}
            options={SORT_OPTIONS}
            placeholder="Newest Accounts"
            clearable
            portal
            className="min-w-[13rem] flex-1"
          />
        </div>
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
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium text-gray-900">
                          {a.siNumber ?? a.accountNumber}
                        </span>
                        {a.isXDeal && <XDealBadge reference={a.xDealReference} />}
                      </span>
                      <CategoryBadge category={a.category} />
                    </div>
                    <div className="mt-0.5 truncate text-[12px] text-gray-500">
                      {a.customer ? a.customer.name : '—'}
                      {a.customer?.phone ? ` · ${a.customer.phone}` : ''}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-[12px] text-gray-500">
                        {a.dueDate ? (
                          <span className={isPastDue(a.dueDate) ? 'font-medium text-red-600' : ''}>
                            Due {shortDate(a.dueDate)}
                          </span>
                        ) : (
                          <StatusBadge status={a.status} />
                        )}
                        {a.dueAmount != null ? ` · MI ${peso(a.dueAmount)}` : ''}
                      </span>
                      <span className="text-[13px] font-semibold tabular-nums text-gray-900">
                        {peso(a.currentBalance)}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table — Cat, SI #, Customer / Contact #, Collector,
              Due Date, MI Due, Outstanding Balance (the client's "OB",
              spelled out), as drawn by the client. */}
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Cat</th>
                    <th className="px-4 py-3">SI #</th>
                    <th className="px-4 py-3">Customer / Contact #</th>
                    <th className="px-4 py-3">Collector</th>
                    <th
                      className="px-4 py-3"
                      aria-sort={
                        dueSort === 'asc' ? 'ascending' : dueSort === 'desc' ? 'descending' : 'none'
                      }
                    >
                      <button
                        type="button"
                        onClick={cycleDueSort}
                        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-800"
                      >
                        Due Date
                        {dueSort === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : dueSort === 'desc' ? (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">MI Due</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Outstanding Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {accounts.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => router.push(`/crm/installment-accounts/${a.id}`)}
                      className="cursor-pointer align-top transition-colors hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <CategoryBadge category={a.category} />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <span className="inline-flex items-center gap-1.5">
                          {a.siNumber ?? a.accountNumber}
                          {a.isXDeal && <XDealBadge reference={a.xDealReference} />}
                        </span>
                        <span className="block font-mono text-[11px] font-normal text-gray-400">
                          {a.accountNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-700">
                        <span className="block">{a.customer ? a.customer.name : '—'}</span>
                        <span className="block text-[12px] text-gray-500">
                          {a.customer?.phone || '—'}
                        </span>
                        {a.status !== 'active' && (
                          <span className="mt-1 inline-block">
                            <StatusBadge status={a.status} />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">
                        {a.collector ? (
                          <>
                            <span className="block">{a.collector.name}</span>
                            <span className="block text-[12px] text-gray-400">
                              {a.collector.stubNumber}
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 text-[13px] ${
                          isPastDue(a.dueDate) ? 'font-medium text-red-600' : 'text-gray-600'
                        }`}
                      >
                        {a.dueDate ? (
                          shortDate(a.dueDate)
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-800">
                        {a.dueAmount != null ? (
                          peso(a.dueAmount)
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
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

          <TablePagination
            page={page}
            pageCount={meta.lastPage}
            onPageChange={setPage}
            pageStart={(page - 1) * PAGE_SIZE}
            pageSize={accounts.length}
            totalItems={meta.total}
            noun="account"
          />
        </>
      )}

      {priceCheckOpen && <PriceCheckModal onClose={() => setPriceCheckOpen(false)} />}
    </div>
  )
}
