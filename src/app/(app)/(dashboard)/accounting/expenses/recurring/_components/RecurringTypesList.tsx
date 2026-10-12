'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { RecurringExpenseTypes, type RecurringExpenseType } from '@/src/libs/data/AccountingV2Data'
import { RowActionsMenu, type RowMenuItem } from '@/src/components/ui/RowActionsMenu'
import ExpensesTabs from '../../_components/ExpensesTabs'
import { RECURRING_PATH } from './recurringListShared'

/**
 * The Recurring tab: the client's List of Recurring Expenses (rental, electricity, water,
 * fuel…). Expenses are filed on the Expenses tab — this is only where the list is kept.
 */
export default function RecurringTypesList() {
  const router = useRouter()
  const [items, setItems] = useState<RecurringExpenseType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      <ExpensesTabs />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-prominent-purple-900">
            <Repeat className="h-6 w-6" /> Recurring Expenses
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            The client&apos;s list of expenses that come round again. Expenses themselves are filed
            on the <strong>Expenses</strong> tab.
          </p>
          <p className="mt-1 max-w-2xl text-[13px] text-gray-400">
            PCF / revolving / special fund replenishment is an Inter-Account Transfer, and
            liquidations are a Special Account entry — they are not expenses, so they are not on
            this list.
          </p>
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
            ) : (
              items.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`${RECURRING_PATH}/${r.id}/edit`)}
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
      </div>
    </div>
  )
}
