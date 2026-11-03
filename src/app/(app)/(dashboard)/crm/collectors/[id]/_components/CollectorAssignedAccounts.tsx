'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { installmentAccountsApi } from '@/src/libs/api/crm'
import TablePagination from '@/src/components/common/TablePagination'
import type { InstallmentAccount } from '@/src/schema/crm/types'

// Same page size as the Installment Accounts list (the API caps it there).
const PAGE_SIZE = 20

const CATEGORY_COLORS: Record<string, string> = {
  A: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  B: 'bg-blue-50 text-blue-700 ring-blue-200',
  C: 'bg-amber-50 text-amber-700 ring-amber-200',
  D: 'bg-red-50 text-red-700 ring-red-200',
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

function peso(amount: number | string): string {
  return `₱${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

/**
 * Scenario 79 — a collector's assigned accounts, paged and searchable. A
 * collector carries a couple of hundred accounts once the aging book is
 * loaded, so this reads the Installment Accounts list API (collectorId +
 * search, 20 a page) instead of rendering every account the collector
 * detail call returns.
 */
export default function CollectorAssignedAccounts({ collectorId }: { collectorId: string }) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<InstallmentAccount[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      const res = await installmentAccountsApi.list({
        collectorId,
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      })
      if (controller.signal.aborted) return
      if (res.success && res.data) {
        setAccounts(res.data.data)
        setMeta({ total: res.data.meta.total, lastPage: res.data.meta.lastPage })
      } else setError(res.error ?? 'Failed to load assigned accounts')
      setLoading(false)
    }, 250)
    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [collectorId, search, page])

  const open = (id: string) => router.push(`/crm/installment-accounts/${id}`)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
      <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Assigned accounts</h2>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            // The page it was on may not exist in the narrower result.
            setPage(1)
          }}
          placeholder="Search account number or customer…"
          aria-label="Search assigned accounts"
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-prominent-orange-400 focus:outline-none"
        />
      </div>

      {loading && accounts.length === 0 && (
        <p className="py-6 text-center text-[13px] text-gray-400">Loading…</p>
      )}
      {!loading && error && <p className="py-6 text-center text-[13px] text-red-500">{error}</p>}
      {!loading && !error && accounts.length === 0 && (
        <p className="py-6 text-center text-[13px] text-gray-400">
          {search
            ? 'No assigned accounts match this search.'
            : 'No installment accounts assigned yet.'}
        </p>
      )}

      {accounts.length > 0 && !error && (
        <div className={loading ? 'opacity-60' : ''}>
          {/* Mobile: cards */}
          <ul className="space-y-2 sm:hidden">
            {accounts.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => open(a.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-100 p-3 text-left active:bg-gray-50"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-gray-900">
                      {a.siNumber ?? a.accountNumber}
                    </div>
                    <div className="truncate text-[12px] text-gray-500">
                      {a.customer?.name ?? '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CategoryBadge category={a.category} />
                    <span className="text-[13px] font-medium tabular-nums text-gray-900">
                      {peso(a.currentBalance)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Account #</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Classification</th>
                  <th className="py-2 pr-4 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {accounts.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => open(a.id)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="py-2.5 pr-4 font-medium text-gray-900">
                      {a.siNumber ?? a.accountNumber}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-700">
                      {a.customer?.name ?? '—'}
                      {a.status !== 'active' && (
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                          {a.status.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <CategoryBadge category={a.category} />
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">{a.classification ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums font-medium text-gray-900">
                      {peso(a.currentBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        </div>
      )}
    </section>
  )
}
