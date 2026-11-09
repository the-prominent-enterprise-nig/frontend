'use client'

import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { SalesReportsParams, Scorecard } from '@/src/schema/pos/sales-reports'
import { getSalesScorecard } from '../../_actions/get-sales-reports'
import DailyMonitoringPanel from './DailyMonitoringPanel'
import ScorecardTable from './ScorecardTable'
import { peso, percent, periodLabel, throughNote } from './scorecard-format'

/**
 * Scenario 85 Parts 5–6 — the Sales per Branch tab: Branch Scorecard and
 * Daily Sales Monitoring. Both read the From–To period (this month to date
 * unless the user picks dates; NIG UAT 2026-11-09).
 */

type SubTab = 'scorecard' | 'daily'

export default function SalesPerBranchTab({
  params,
  title,
}: {
  params: SalesReportsParams
  /** "Negros Operations", "Bago", or "All Operations". */
  title: string
}): React.JSX.Element {
  const [sub, setSub] = useState<SubTab>('scorecard')

  return (
    <section
      role="tabpanel"
      className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4"
    >
      <div className="flex gap-2" role="tablist" aria-label="Sales per Branch views">
        {(
          [
            ['scorecard', 'Branch Scorecard'],
            ['daily', 'Daily Sales Monitoring'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={sub === key}
            onClick={() => setSub(key)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              sub === key
                ? 'border-prominent-purple-700 bg-prominent-purple-700 text-white'
                : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === 'scorecard' ? (
        <ScorecardPanel params={params} title={title} />
      ) : (
        <DailyMonitoringPanel params={params} title={title} />
      )}
    </section>
  )
}

function ScorecardPanel({
  params,
  title,
}: {
  params: SalesReportsParams
  title: string
}): React.JSX.Element {
  const query = useQuery({
    queryKey: ['pos-sales-report-scorecard', params],
    queryFn: async () => {
      const res = await getSalesScorecard(params)
      if (!res.success || !res.data) throw new Error(res.error ?? 'Could not load the scorecard')
      return res.data
    },
    placeholderData: keepPreviousData,
  })

  if (query.isError) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Could not load the scorecard for these filters. Try again.
      </p>
    )
  }
  if (!query.data) return <p className="py-12 text-center text-sm text-zinc-500">Loading…</p>
  const card = query.data

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-prominent-purple-700">
          {periodLabel(card.period.from, card.period.to)}
        </p>
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <p className="text-xs text-zinc-500">Branch Scorecard</p>
      </div>
      <Kpis card={card} />
      <ScorecardTable card={card} />
      <p className="text-[11px] leading-relaxed text-zinc-500">
        From the From date through the To date.{throughNote(card.period)} Quota is each month&apos;s
        quota, prorated for the days of it the period covers. Sales are gross (LCP, VAT-inclusive),
        with refunds netted in. Click a branch to see its daily sales. The tick on each bar marks
        where a branch should be today to stay on pace for the period. Status: Met is 100% or more,
        Ahead is at or past the tick, Behind is past half of it, Far behind is under half. AC Unit +
        Services carries every Split Type unit and service line, so it counts in Grand Total but not
        in Total Branches.
      </p>
    </div>
  )
}

function Kpis({ card }: { card: Scorecard }): React.JSX.Element {
  const tb = card.totalBranches
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="Total Branches (gross)" value={peso(tb.total)} />
      <Kpi label={`Ach Rate (pace ${percent(card.period.pace)})`} value={percent(tb.achRate)} />
      <Kpi label="Ahead of pace or met" value={`${card.aheadOrMet} of ${card.branchCount}`} />
      <Kpi label="BTS (balance to quota)" value={peso(tb.bts)} />
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-zinc-200 px-4 py-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-900 tabular-nums">{value}</div>
    </div>
  )
}
