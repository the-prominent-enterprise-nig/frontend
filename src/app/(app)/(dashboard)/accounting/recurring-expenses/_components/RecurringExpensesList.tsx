'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Pause, Pencil, Play, Plus, Repeat, Trash2, FilePlus2 } from 'lucide-react'
import {
  RecurringExpenses,
  fmtDate,
  fmtMoney,
  type RecurringExpense,
  type RecurringFrequency,
  type RecurringRunSummary,
} from '@/src/libs/data/AccountingV2Data'
import { RowActionsMenu, type RowMenuItem } from '@/src/components/ui/RowActionsMenu'

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  MONTHLY: 'Monthly',
  WEEKLY: 'Weekly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
  AS_NEEDED: 'As needed',
}

const DRAFT_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  RECORDED: 'bg-emerald-50 text-emerald-700',
  VOID: 'bg-red-50 text-red-600',
}

/** Today as a YYYY-MM-DD string in the client's own (Philippine) day. */
const todayInManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

/** What state it is in, in a word: paused, failing, due, or on schedule. */
function statusOf(r: RecurringExpense): { label: string; className: string; title?: string } {
  if (!r.isActive) return { label: 'Paused', className: 'bg-gray-100 text-gray-600' }
  if (r.lastError)
    return {
      label: 'Failed — will retry',
      className: 'bg-red-50 text-red-700',
      title: r.lastError,
    }
  if (r.frequency === 'AS_NEEDED')
    return { label: 'As needed', className: 'bg-sky-50 text-sky-700' }
  if (r.nextRunDate && r.nextRunDate.slice(0, 10) <= todayInManila())
    return {
      label: 'Due',
      className: 'bg-amber-50 text-amber-700',
      title: 'Its draft is made by the daily run, or now with Create draft now',
    }
  return { label: 'Active', className: 'bg-emerald-50 text-emerald-700' }
}

export default function RecurringExpensesList() {
  const router = useRouter()
  const [items, setItems] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runSummary, setRunSummary] = useState<RecurringRunSummary | null>(null)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    const res = await RecurringExpenses.list()
    if (res.success) setItems(res.data ?? [])
    else setError(res.message || res.error || 'Could not load recurring expenses')
    setLoading(false)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  /** The next due one early (it then moves on), or today's for an "as needed" one —
   * then straight to the draft it made, to look it over. */
  const createDraft = async (r: RecurringExpense) => {
    const res = await RecurringExpenses.run(r.id)
    if (!res.success || !res.data) {
      alert(res.message || res.error || 'Could not create the draft')
      return load()
    }
    router.push(`/accounting/expenses/${res.data.id}`)
  }

  const runDue = async () => {
    setRunning(true)
    setError(null)
    const res = await RecurringExpenses.runDue()
    setRunning(false)
    if (res.success && res.data) setRunSummary(res.data)
    else setError(res.message || res.error || 'The run failed')
    await load()
  }

  const togglePause = async (r: RecurringExpense) => {
    const res = await RecurringExpenses.update(r.id, { isActive: !r.isActive })
    if (!res.success) alert(res.message || res.error || 'Could not update it')
    await load()
  }

  const remove = async (r: RecurringExpense) => {
    if (!confirm(`Delete "${r.name}"? The drafts it already made stay; no more will be made.`))
      return
    const res = await RecurringExpenses.remove(r.id)
    if (!res.success) alert(res.message || res.error || 'Delete failed')
    await load()
  }

  const menu = (r: RecurringExpense): RowMenuItem[] => [
    {
      label: r.frequency === 'AS_NEEDED' ? 'Create draft now' : 'Create next draft now',
      icon: FilePlus2,
      onClick: () => createDraft(r),
    },
    {
      label: 'Edit',
      icon: Pencil,
      onClick: () => router.push(`/accounting/recurring-expenses/${r.id}/edit`),
    },
    {
      label: r.isActive ? 'Pause' : 'Resume',
      icon: r.isActive ? Pause : Play,
      onClick: () => togglePause(r),
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
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Expenses that come round again — rent, electricity, water. Saved once; a{' '}
            <strong>draft</strong> is made on each due date and nothing posts until you record it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runDue}
            disabled={running}
            title="Make every draft that is due now — what the daily run does at 6 am"
            className="rounded-lg border border-prominent-purple-700 px-4 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-60"
          >
            {running ? 'Running…' : 'Run due now'}
          </button>
          <Link
            href="/accounting/recurring-expenses/new"
            className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-prominent-purple-800"
          >
            <Plus className="h-4 w-4" /> New recurring expense
          </Link>
        </div>
      </div>

      {runSummary && (
        <div
          role="status"
          className={`mb-3 rounded-lg border px-3 py-2 text-sm ${
            runSummary.failed.length
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          {runSummary.checked === 0
            ? 'Nothing is due.'
            : `${runSummary.generated} draft${runSummary.generated === 1 ? '' : 's'} made.`}
          {runSummary.failed.map((f) => (
            <p key={f.id} className="mt-1">
              <strong>{f.name}</strong> could not be made: {f.reason}
            </p>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Payee</th>
              <th className="px-3 py-2 text-right">Usually</th>
              <th className="px-3 py-2 text-left">Repeats</th>
              <th className="px-3 py-2 text-left">Next due</th>
              <th className="px-3 py-2 text-left">Latest draft</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-gray-500">
                  <p>No recurring expenses yet.</p>
                  <p className="mt-1 text-[13px] text-gray-400">
                    Start one from the client&apos;s list (rent, electricity, water…), or open any
                    expense and choose <em>Make recurring</em>.
                  </p>
                </td>
              </tr>
            ) : (
              items.map((r) => {
                const st = statusOf(r)
                const draft = r.drafts?.[0]
                return (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/accounting/recurring-expenses/${r.id}/edit`)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 font-medium text-prominent-purple-900">{r.name}</td>
                    <td className="px-3 py-2 text-gray-600">{r.payeeLabel ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.usualAmount)}</td>
                    <td className="px-3 py-2 text-gray-600">{FREQUENCY_LABELS[r.frequency]}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.nextRunDate ? fmtDate(r.nextRunDate) : '—'}
                      {r.endDate && (
                        <span className="block text-[11px] text-gray-400">
                          until {fmtDate(r.endDate)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs" onClick={(ev) => ev.stopPropagation()}>
                      {draft ? (
                        <Link
                          href={`/accounting/expenses/${draft.id}`}
                          className="inline-flex items-center gap-1.5 hover:underline"
                        >
                          <span className="font-mono">
                            {draft.voucherNumber || draft.expenseNumber}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${DRAFT_STYLES[draft.status] ?? 'bg-gray-100 text-gray-600'}`}
                          >
                            {draft.status}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        title={st.title}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.className}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right" onClick={(ev) => ev.stopPropagation()}>
                      <RowActionsMenu items={menu(r)} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
