'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/src/components/ui/Skeleton'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import type { PriceOverrideLogEntry } from '@/src/schema/pos'
import { todayIso } from '../../daily-collection/_utils/business-date'
import { getBranches, getPriceOverrideLog } from '../../_actions/pos-actions'
import OverrideEntryRow from './OverrideEntryRow'
import { ENTRY_GRID, peso, pct } from './override-review-format'

type Tab = 'all' | 'flagged'

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'flagged', label: 'Flagged' },
]

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

interface Props {
  /** Set for a branch-assigned user — their own branch, which the API enforces
   * whatever is asked. Null for Head Office and the owner, who see every branch
   * and may narrow to one. */
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
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-700">{label}</p>
      <p className={`text-base font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

/**
 * The Price Override Log (Scenario 71 Part 4; it was the Override Review): every
 * exception the floor took — a price below list, terms typed by hand, a waived
 * down payment or credit application — as a record to read.
 *
 * The sale already posted at the counter and nothing here waits on anyone:
 * no approve or reject, no sign-off, no PIN. A branch user reads their own
 * branch; Head Office reads every branch, over any period, and can narrow to one.
 */
export default function PriceOverrideLogView({
  sessionBranchId,
  sessionBranchName,
}: Props): React.JSX.Element {
  // Deep link — ?from=&to=&branchId= — opens straight on a period and branch.
  const params = useSearchParams()
  const linkedFrom = params.get('from')
  const linkedTo = params.get('to')
  const today = todayIso()
  const [from, setFrom] = useState(linkedFrom && ISO_DAY.test(linkedFrom) ? linkedFrom : today)
  const [to, setTo] = useState(
    linkedTo && ISO_DAY.test(linkedTo)
      ? linkedTo
      : linkedFrom && ISO_DAY.test(linkedFrom)
        ? linkedFrom
        : today
  )
  const [branchFilter, setBranchFilter] = useState(params.get('branchId') ?? '')
  const [tab, setTab] = useState<Tab>('all')

  // A branch-assigned user is pinned to their own branch; anyone else can pick
  // one, and no pick means every branch's entries together.
  const scopedBranchId = sessionBranchId ?? (branchFilter || null)

  const { data: branchList } = useQuery({
    queryKey: ['pos-branches'],
    queryFn: getBranches,
    enabled: !sessionBranchId,
    staleTime: 5 * 60_000,
  })
  const branchOptions = (branchList?.success ? (branchList.data ?? []) : []).map((b) => ({
    value: b.id,
    label: b.name,
  }))
  const scopedBranchName =
    sessionBranchName ?? branchOptions.find((b) => b.value === scopedBranchId)?.label ?? null

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pos-price-override-log', from, to, scopedBranchId],
    queryFn: () => getPriceOverrideLog(from, to, scopedBranchId ?? undefined),
  })
  const log = data?.success ? data.data : undefined

  // Keep the two ends in order: moving one past the other drags the other along.
  function changeFrom(next: string) {
    if (!ISO_DAY.test(next)) return
    setFrom(next)
    if (next > to) setTo(next)
  }
  function changeTo(next: string) {
    if (!ISO_DAY.test(next)) return
    setTo(next)
    if (next < from) setFrom(next)
  }

  const entries: PriceOverrideLogEntry[] = log?.entries ?? []
  const visible = entries.filter((e) => (tab === 'flagged' ? e.flags.length > 0 : true))
  // Several overridden lines on one sale read "Item 1 of 2 in this sale" — counted
  // over the whole period, so a tab filter does not change the numbering.
  const onSale = new Map<string, string[]>()
  for (const e of entries)
    onSale.set(e.transactionId, [...(onSale.get(e.transactionId) ?? []), e.id])
  const counts: Record<Tab, number> = {
    all: entries.length,
    flagged: entries.filter((e) => e.flags.length > 0).length,
  }

  const oneDay = from === to
  const periodLabel = oneDay ? 'on this day' : 'in this period'

  return (
    <div className="space-y-4 px-6 py-5" data-testid="override-review">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-prominent-purple-900">Price Override Log</h1>
          <p className="text-[13px] text-gray-700">
            Price overrides, typed installment terms and waivers taken at the counter
            {scopedBranchName ? ` — ${scopedBranchName}` : ' — all branches'}.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {!sessionBranchId && (
            <div className="w-56" data-testid="branch-filter">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Branch</label>
              <SearchableSelect
                value={branchFilter}
                onChange={(value) => setBranchFilter(value)}
                options={branchOptions}
                placeholder="All branches"
                ariaLabel="Branch"
                loading={!branchList}
                clearable
                portal
              />
            </div>
          )}
          <div>
            <label
              htmlFor="override-log-from"
              className="mb-1 block text-xs font-semibold text-gray-600"
            >
              From
            </label>
            <input
              id="override-log-from"
              className="input"
              type="date"
              value={from}
              max={today}
              onChange={(e) => changeFrom(e.target.value)}
              data-testid="log-from"
            />
          </div>
          <div>
            <label
              htmlFor="override-log-to"
              className="mb-1 block text-xs font-semibold text-gray-600"
            >
              To
            </label>
            <input
              id="override-log-to"
              className="input"
              type="date"
              value={to}
              max={today}
              onChange={(e) => changeTo(e.target.value)}
              data-testid="log-to"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError || !log ? (
        <p className="py-16 text-center text-sm text-red-600" data-testid="override-review-error">
          {(data && !data.success && data.error) || 'Could not load the price override log.'}
        </p>
      ) : (
        <>
          {/* KPI strip */}
          <div
            className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-gray-200 py-3 sm:grid-cols-3 lg:grid-cols-5"
            data-testid="override-kpis"
          >
            <Kpi testId="kpi-entries" label="Entries" value={String(log.kpis.entries)} />
            <Kpi
              testId="kpi-difference"
              label="Total Discount Granted"
              value={peso(log.kpis.totalDifference)}
              tone={log.kpis.totalDifference > 0 ? 'text-red-600' : 'text-prominent-purple-900'}
            />
            <Kpi
              testId="kpi-avg-below"
              label="Avg below list"
              value={pct(log.kpis.averageBelowListPct)}
            />
            <Kpi testId="kpi-flagged" label="Flagged" value={String(log.kpis.flagged)} />
            <Kpi testId="kpi-dp-waived" label="DP waived" value={String(log.kpis.dpWaived)} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 self-start rounded-lg bg-gray-100 p-1 w-fit" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={tab === t.value}
                data-testid={`tab-${t.value}`}
                onClick={() => setTab(t.value)}
                className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors ${
                  tab === t.value
                    ? 'bg-white text-prominent-purple-900 shadow-sm'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                {t.label} <span className="text-xs text-gray-600">{counts[t.value]}</span>
              </button>
            ))}
          </div>

          {/* Entries */}
          {visible.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-700" data-testid="override-empty">
              {entries.length === 0
                ? `No exceptions were taken ${periodLabel}.`
                : 'No flagged entries.'}
            </p>
          ) : (
            <div
              className="@container overflow-x-auto rounded-xl border border-gray-200 bg-white"
              data-testid="override-list"
            >
              <div className="min-w-[1310px]" role="table">
                <div
                  role="row"
                  className={`${ENTRY_GRID} border-b border-l-[3px] border-gray-200 border-l-transparent bg-gray-50 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-gray-700`}
                >
                  {/* sr-only is absolutely positioned and would drop out of the grid,
                      shifting every label a column left — keep a real, empty cell. */}
                  <span role="columnheader">
                    <span className="sr-only">Details</span>
                  </span>
                  <span role="columnheader">Sale</span>
                  <span role="columnheader">Date</span>
                  <span role="columnheader">Branch</span>
                  <span role="columnheader">Customer</span>
                  <span role="columnheader">Item</span>
                  <span role="columnheader" className="text-right">
                    Price
                  </span>
                  <span role="columnheader" className="text-right">
                    Discount
                  </span>
                  <span role="columnheader">Payment</span>
                  <span role="columnheader">Flags</span>
                  <span role="columnheader">Cashier</span>
                </div>
                {visible.map((entry) => {
                  const sale = onSale.get(entry.transactionId) ?? []
                  return (
                    <OverrideEntryRow
                      key={entry.id}
                      entry={entry}
                      itemNo={Math.max(sale.indexOf(entry.id), 0) + 1}
                      itemsOnSale={sale.length || 1}
                      thresholdPct={log.flagThresholdPct}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
