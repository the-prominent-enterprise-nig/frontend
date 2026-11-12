'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Plus, Repeat, Search, Trash2, X } from 'lucide-react'
import { RecurringExpenseTypes, type RecurringExpenseType } from '@/src/libs/data/AccountingV2Data'
import { RowActionsMenu, type RowMenuItem } from '@/src/components/ui/RowActionsMenu'
import { RECURRING_PATH } from './recurringListShared'

const PAGE_SIZE = 10

/**
 * The Recurring tab: the client's List of Recurring Expenses (rental, electricity, water,
 * fuel…). Expenses are filed on the Expenses tab — this is only where the list is kept.
 * Clicking an entry opens the amounts recorded under it. The whole list is one small
 * company-wide fetch, so search and paging are done here on what came back.
 */
export default function RecurringTypesList() {
  const router = useRouter()
  const [items, setItems] = useState<RecurringExpenseType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Matches the expense name or its account, by number or by name.
  const q = search.trim().toLowerCase()
  const matches = useMemo(
    () =>
      q
        ? items.filter((r) =>
            [r.name, r.account?.number, r.account?.name].some((s) => s?.toLowerCase().includes(q))
          )
        : items,
    [items, q]
  )
  const total = matches.length
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  // Taking off the last entry of the last page must not leave an empty page behind.
  const currentPage = Math.min(page, lastPage)
  const rows = matches.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const load = useCallback(async () => {
    const res = await RecurringExpenseTypes.list()
    if (res.success) {
      setItems(res.data ?? [])
      setError(null)
    } else setError(res.message || res.error || 'Could not load the list')
    setLoading(false)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const remove = async (r: RecurringExpenseType) => {
    if (!confirm(`Take "${r.name}" off the list?`)) return
    const res = await RecurringExpenseTypes.remove(r.id)
    if (!res.success) setError(res.message || res.error || 'Delete failed')
    await load()
  }

  const menu = (r: RecurringExpenseType): RowMenuItem[] => [
    {
      label: 'Edit',
      icon: Pencil,
      onClick: () => router.push(`${RECURRING_PATH}/${r.id}/edit`),
    },
    { label: 'Delete', icon: Trash2, onClick: () => remove(r), variant: 'danger' as const },
  ]

  return (
    <div className="px-6 py-5 lg:px-10">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-prominent-purple-900">
            <Repeat className="h-6 w-6" /> Recurring Expenses
          </h1>
        </div>
        <Link
          href={`${RECURRING_PATH}/new`}
          className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800"
        >
          <Plus className="h-4 w-4" /> Add to list
        </Link>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search by expense or account…"
            aria-label="Search recurring expenses"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
          />
        </div>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setPage(1)
            }}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>

      <div
        data-testid="recurring-list"
        className="overflow-x-auto rounded-lg border border-gray-200 bg-white"
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Expense</th>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-10 text-center text-gray-500">
                  <p>The list is empty.</p>
                  <p className="mt-1 text-[13px] text-gray-400">
                    Add the client&apos;s recurring expenses — rental, electricity, water…
                  </p>
                </td>
              </tr>
            ) : total === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  data-testid="recurring-no-match"
                  className="px-3 py-10 text-center text-gray-500"
                >
                  No entries match that search
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`${RECURRING_PATH}/${r.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium text-prominent-purple-900">{r.name}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {r.account ? (
                      <>
                        <span className="font-mono text-xs">{r.account.number}</span> —{' '}
                        {r.account.name}
                      </>
                    ) : (
                      <span className="text-gray-400">Picked each time</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                    <RowActionsMenu items={menu(r)} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {total > 0 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs text-zinc-500" data-testid="recurring-list-summary">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)}{' '}
              of {total} {total === 1 ? 'entry' : 'entries'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-zinc-500">
                {currentPage} / {lastPage}
              </span>
              <button
                type="button"
                onClick={() => setPage(Math.min(lastPage, currentPage + 1))}
                disabled={currentPage >= lastPage}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
