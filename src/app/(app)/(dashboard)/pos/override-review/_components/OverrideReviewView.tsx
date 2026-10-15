'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, CheckCircle2, Lock, Loader2 } from 'lucide-react'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { showToast } from '@/src/components/ui/toast'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import type { OverrideReviewDay, OverrideReviewEntry } from '@/src/schema/pos'
import DateStepper from '../../daily-collection/_components/DateStepper'
import { todayIso } from '../../daily-collection/_utils/business-date'
import {
  approveAllOverrideEntries,
  decideOverrideEntry,
  getOverrideReview,
  signOffOverrideDay,
} from '../../_actions/pos-actions'
import OverrideEntryRow from './OverrideEntryRow'
import { formatDay, formatTime, peso, pct } from './override-review-format'

type Tab = 'all' | 'flagged' | 'pending'

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'pending', label: 'Pending' },
]

interface Props {
  /** Set for a branch-assigned user — their own branch, which the API enforces
   * whatever the switcher says. Null for an owner. */
  sessionBranchId: string | null
  sessionBranchName: string | null
}

function Kpi({
  label,
  value,
  tone = 'text-prominent-purple-900',
  testId,
}: {
  label: string
  value: string
  tone?: string
  testId: string
}) {
  return (
    // Label on top, figure at the bottom: a label that wraps (Total Discount
    // Granted in a narrow cell) pushes its own figure down without leaving the
    // others out of line.
    <div className="flex flex-col justify-between gap-1" data-testid={testId}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-0.5 text-xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

/**
 * Scenario 71 Part 4 — the end-of-day review of every exception the floor
 * took: a price below list, terms typed by hand, a waived down payment or
 * credit application.
 *
 * The sale already posted at the counter; this page is the after-the-fact
 * look the client asked for in place of a gate. Approve is a click, Reject
 * needs a note and only records the decision (nothing is reversed), and
 * signing the day off locks it. Deliberately no PIN anywhere on this page.
 */
export default function OverrideReviewView({
  sessionBranchId,
  sessionBranchName,
}: Props): React.JSX.Element {
  const { branchId, branchName, setBranch } = usePosBranchContext()
  const queryClient = useQueryClient()

  // Deep link, same convention as Daily Collection — ?date=&branchId=&branchName=
  // opens straight on one branch's day instead of whatever the switcher held.
  const params = useSearchParams()
  const linkedDate = params.get('date')
  const linkedBranchId = params.get('branchId')
  const linkedBranchName = params.get('branchName')
  const [date, setDate] = useState(
    linkedDate && /^\d{4}-\d{2}-\d{2}$/.test(linkedDate) ? linkedDate : todayIso()
  )

  // Once per link: afterwards the switcher is the user's again.
  useEffect(() => {
    if (linkedBranchId && linkedBranchId !== branchId) {
      setBranch({ id: linkedBranchId, name: linkedBranchName ?? '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedBranchId])
  const [tab, setTab] = useState<Tab>('all')

  // A branch-assigned user is pinned to their own branch; an owner follows
  // the switcher, and no branch picked means every branch's entries together.
  const scopedBranchId = sessionBranchId ?? branchId
  const scopedBranchName = sessionBranchName ?? branchName

  const queryKey = ['pos-override-review', date, scopedBranchId]
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getOverrideReview(date, scopedBranchId ?? undefined),
  })
  const day: OverrideReviewDay | undefined = data?.success ? data.data : undefined

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['pos-override-review'] })
    queryClient.invalidateQueries({ queryKey: ['pos-override-pending-count'] })
  }

  const decide = useMutation({
    mutationFn: (v: { id: string; status: 'approved' | 'rejected'; note?: string }) =>
      decideOverrideEntry(v.id, v.status, v.note),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: result.error ?? 'Could not save the decision', status: 'error' })
        return
      }
      refresh()
    },
    onError: () => {
      showToast({ title: 'The decision did not reach the server — try again', status: 'error' })
      refresh()
    },
  })

  const approveAll = useMutation({
    mutationFn: () => approveAllOverrideEntries(date, scopedBranchId ?? undefined),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: result.error ?? 'Could not approve the entries', status: 'error' })
        return
      }
      showToast({
        title: `Approved ${result.data?.approved ?? 0} ${result.data?.approved === 1 ? 'entry' : 'entries'}`,
        status: 'success',
      })
      refresh()
    },
    onError: () => {
      showToast({ title: 'Approving did not reach the server — try again', status: 'error' })
      refresh()
    },
  })

  const signOff = useMutation({
    mutationFn: () => signOffOverrideDay(date, scopedBranchId ?? undefined),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({ title: result.error ?? 'Could not sign off the day', status: 'error' })
        return
      }
      showToast({ title: 'Day signed off', status: 'success' })
      refresh()
    },
    onError: () => {
      showToast({ title: 'Signing off did not reach the server — try again', status: 'error' })
      refresh()
    },
  })

  const entries: OverrideReviewEntry[] = day?.entries ?? []
  const visible = entries.filter((e) => {
    if (tab === 'flagged') return e.flags.length > 0
    if (tab === 'pending') return e.status === 'pending'
    return true
  })
  // Several overridden lines on one sale read "Item 1 of 2 in this sale" — counted
  // over the whole day, so a tab filter does not change the numbering.
  const onSale = new Map<string, { order: string[] }>()
  for (const e of entries) {
    const sale = onSale.get(e.transactionId) ?? { order: [] }
    sale.order.push(e.id)
    onSale.set(e.transactionId, sale)
  }
  const counts: Record<Tab, number> = {
    all: entries.length,
    flagged: entries.filter((e) => e.flags.length > 0).length,
    pending: entries.filter((e) => e.status === 'pending').length,
  }

  // The sign-off belongs to one branch's day. Pending entries must be
  // decided first — the API says so too, this just keeps the button honest.
  const scopedSignOff = scopedBranchId
    ? day?.signOffs.find((s) => s.branchId === scopedBranchId)
    : undefined
  const livePending = entries.filter((e) => e.status === 'pending').length
  const liveCount = entries.filter((e) => e.status !== 'voided').length
  const canSignOff =
    !!scopedBranchId && !scopedSignOff && liveCount > 0 && livePending === 0 && !signOff.isPending

  return (
    <div className="space-y-6 px-6 py-6" data-testid="override-review">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-prominent-purple-900">Override Review</h1>
          <p className="text-sm text-gray-500">
            Price overrides, typed installment terms and waivers taken at the counter
            {scopedBranchName ? ` — ${scopedBranchName}` : ' — all branches'}. Decide each one, then
            sign the day off.
          </p>
        </div>
        <DateStepper value={date} onChange={setDate} />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError || !day ? (
        <p className="py-16 text-center text-sm text-red-600" data-testid="override-review-error">
          {(data && !data.success && data.error) || 'Could not load the override review.'}
        </p>
      ) : (
        <>
          {/* KPI strip */}
          <div
            className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-gray-200 py-4 sm:grid-cols-4 lg:grid-cols-7"
            data-testid="override-kpis"
          >
            <Kpi testId="kpi-entries" label="Entries" value={String(day.kpis.entries)} />
            <Kpi
              testId="kpi-pending"
              label="Pending"
              value={String(day.kpis.pending)}
              tone={day.kpis.pending > 0 ? 'text-orange-600' : 'text-prominent-purple-900'}
            />
            <Kpi
              testId="kpi-difference"
              label="Total Discount Granted"
              value={peso(day.kpis.totalDifference)}
              tone={day.kpis.totalDifference > 0 ? 'text-red-600' : 'text-prominent-purple-900'}
            />
            <Kpi
              testId="kpi-avg-below"
              label="Avg below list"
              value={pct(day.kpis.averageBelowListPct)}
            />
            <Kpi testId="kpi-flagged" label="Flagged" value={String(day.kpis.flagged)} />
            <Kpi testId="kpi-dp-waived" label="DP waived" value={String(day.kpis.dpWaived)} />
            <Kpi testId="kpi-rejected" label="Rejected" value={String(day.kpis.rejected)} />
          </div>

          {/* Other days still waiting — the sidebar badge counts them too */}
          {day.pendingDays.length > 0 && (
            <p
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-orange-700"
              data-testid="pending-days"
            >
              <span className="font-semibold">Also waiting for a decision:</span>
              {day.pendingDays.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  data-testid="pending-day"
                  onClick={() => setDate(d.date)}
                  className="rounded-md bg-orange-50 px-2 py-0.5 font-medium text-orange-700 hover:bg-orange-100"
                >
                  {formatDay(`${d.date}T12:00:00`)} · {d.count}
                </button>
              ))}
            </p>
          )}

          {/* Sign-off strip */}
          {day.signOffs.length > 0 && (
            <div className="space-y-1" data-testid="override-signoffs">
              {day.signOffs.map((s) => (
                <p
                  key={s.branchId}
                  className="flex flex-wrap items-center gap-x-2 text-sm text-green-700"
                >
                  <Lock size={14} />
                  <span className="font-semibold">{s.branchName ?? 'Branch'} signed off</span>
                  <span className="text-gray-600">
                    by {s.signedByName ?? 'a reviewer'} · {formatDay(s.signedAt)}{' '}
                    {formatTime(s.signedAt)} · {s.approvedCount} approved, {s.rejectedCount}{' '}
                    rejected · Total discount granted {peso(s.totalDifference)}
                  </span>
                </p>
              ))}
            </div>
          )}

          {/* Tabs + day actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.value}
                  data-testid={`tab-${t.value}`}
                  onClick={() => setTab(t.value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    tab === t.value
                      ? 'bg-white text-prominent-purple-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label} <span className="text-xs text-gray-400">{counts[t.value]}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {!scopedBranchId && liveCount > 0 && (
                <p className="text-xs text-gray-500">
                  Pick a branch in the switcher to approve all or sign off — a day is signed off one
                  branch at a time.
                </p>
              )}
              <button
                type="button"
                data-testid="approve-all"
                disabled={livePending === 0 || approveAll.isPending || !!scopedSignOff}
                onClick={() => approveAll.mutate()}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {approveAll.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CheckCheck size={14} />
                )}
                Approve all pending
              </button>
              <button
                type="button"
                data-testid="sign-off"
                disabled={!canSignOff}
                onClick={() => signOff.mutate()}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-prominent-purple-900 px-3 text-sm font-semibold text-white hover:bg-prominent-purple-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {signOff.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : scopedSignOff ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <Lock size={14} />
                )}
                {scopedSignOff ? 'Signed off' : 'Sign off day'}
              </button>
            </div>
          </div>

          {/* Entries */}
          {visible.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-500" data-testid="override-empty">
              {entries.length === 0
                ? 'No exceptions were taken on this day.'
                : tab === 'pending'
                  ? 'Nothing is waiting for a decision.'
                  : 'No flagged entries.'}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead className="bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-2.5 py-2.5">Time</th>
                    <th className="px-2.5 py-2.5">Sale</th>
                    <th className="px-2.5 py-2.5">Item</th>
                    <th className="px-2.5 py-2.5">Seller</th>
                    <th className="px-2.5 py-2.5">Plan</th>
                    <th className="px-2.5 py-2.5 text-right">List</th>
                    <th className="px-2.5 py-2.5 text-right">Override</th>
                    <th className="px-2.5 py-2.5 text-right">Discount</th>
                    <th className="px-2.5 py-2.5">Reason</th>
                    <th className="px-2.5 py-2.5">Flags</th>
                    <th className="sticky right-0 bg-gray-50 px-2.5 py-2.5 text-right">Decision</th>
                  </tr>
                </thead>
                {visible.map((entry) => {
                  const sale = onSale.get(entry.transactionId)
                  return (
                    <OverrideEntryRow
                      key={entry.id}
                      entry={entry}
                      itemNo={(sale?.order.indexOf(entry.id) ?? 0) + 1}
                      itemsOnSale={sale?.order.length ?? 1}
                      showBranch={day.branchId === null}
                      thresholdPct={day.flagThresholdPct}
                      busy={decide.isPending && decide.variables?.id === entry.id}
                      onDecide={(status, note) => decide.mutate({ id: entry.id, status, note })}
                    />
                  )
                })}
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
