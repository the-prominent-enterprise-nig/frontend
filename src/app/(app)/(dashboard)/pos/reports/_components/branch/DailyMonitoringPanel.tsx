'use client'

import { Fragment, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type {
  DailyMonitoring,
  SalesReportsParams,
  ScorecardRow,
} from '@/src/schema/pos/sales-reports'
import { getSalesDailyMonitoring } from '../../_actions/get-sales-reports'
import { monitoringWeeks, type MonitoringWeek } from './monitoring-weeks'
import { peso, percent, periodLabel, shortDay, throughNote } from './scorecard-format'

/**
 * Scenario 85 Part 6 — Daily Sales Monitoring: one column per branch (and
 * the AC Unit + Services line), one row per day in collapsible 8-day weeks,
 * each day's total over its office sales; then the period's total against
 * quota, and last year's figures from the system's own sales.
 *
 * The same rows as the Branch Scorecard, read day by day, so the two never
 * disagree.
 */

export default function DailyMonitoringPanel({
  params,
  title,
}: {
  params: SalesReportsParams
  title: string
}): React.JSX.Element {
  const query = useQuery({
    queryKey: ['pos-sales-report-daily-monitoring', params],
    queryFn: async () => {
      const res = await getSalesDailyMonitoring(params)
      if (!res.success || !res.data) throw new Error(res.error ?? 'Could not load the sheet')
      return res.data
    },
    placeholderData: keepPreviousData,
  })

  if (query.isError) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Could not load Daily Sales Monitoring for these filters. Try again.
      </p>
    )
  }
  if (!query.data) return <p className="py-12 text-center text-sm text-zinc-500">Loading…</p>
  const { period } = query.data.scorecard

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-prominent-purple-700">
          {periodLabel(period.from, period.to)}
        </p>
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <p className="text-xs text-zinc-500">Daily Sales Monitoring</p>
        <p className="mt-1 text-[11px] text-zinc-500">
          From the From date through the To date.{throughNote(period)} Sales are gross (LCP,
          VAT-inclusive), with refunds netted in. Quota is each month&apos;s quota, prorated for the
          days of it the period covers.
        </p>
      </div>
      <MonitoringGrid data={query.data} />
      <Comparisons comparisons={query.data.comparisons} />
    </div>
  )
}

/** Branches A–Z, then the AC Unit + Services line, as the sheet numbers them. */
function columnsOf(rows: ScorecardRow[]): ScorecardRow[] {
  return [...rows].sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'line' ? 1 : -1
  )
}

function sum(row: ScorecardRow, indexes: number[], field: 'total' | 'office'): number {
  return indexes.reduce((s, i) => s + (row.daily[i]?.[field] ?? 0), 0)
}

function MonitoringGrid({ data }: { data: DailyMonitoring }): React.JSX.Element {
  const columns = columnsOf(data.scorecard.rows)
  const days = data.scorecard.rows[0]?.daily.map((d) => d.day) ?? []
  const weeks = monitoringWeeks(days)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const allCollapsed = collapsed.size === weeks.length

  const toggle = (n: number): void =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(weeks.map((w) => w.number)))}
        className="self-start rounded-lg px-2 py-1 text-xs font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
      >
        {allCollapsed ? 'Show all weeks' : 'Hide all weeks'}
      </button>
      <div className="max-h-[75vh] overflow-auto rounded-lg border border-zinc-200">
        {/* w-full: a branch-locked user gets one or two columns, which should
            fill the panel instead of sitting in a narrow strip. */}
        <table className="w-full min-w-max text-[11px]">
          <GridHead columns={columns} />
          <tbody>
            {weeks.map((week) => (
              <WeekRows
                key={week.number}
                week={week}
                columns={columns}
                open={!collapsed.has(week.number)}
                onToggle={() => toggle(week.number)}
              />
            ))}
            <SummaryRows columns={columns} weeks={weeks} />
          </tbody>
        </table>
      </div>
    </div>
  )
}

const STICKY = 'sticky left-0 z-10'

function GridHead({ columns }: { columns: ScorecardRow[] }): React.JSX.Element {
  return (
    <thead className="sticky top-0 z-20">
      <tr className="bg-emerald-50 text-emerald-900">
        <th className={`${STICKY} bg-emerald-50 px-3 pt-2 text-left`} />
        {columns.map((c, i) => (
          <th key={c.key} scope="col" className="px-3 pt-2 text-right font-semibold">
            {i + 1}
          </th>
        ))}
      </tr>
      <tr className="border-b border-emerald-200 bg-emerald-50 text-emerald-900">
        <th scope="col" className={`${STICKY} bg-emerald-50 px-3 pb-2 text-left font-semibold`}>
          Day
        </th>
        {columns.map((c) => (
          <th
            key={c.key}
            scope="col"
            className="px-3 pb-2 text-right font-semibold whitespace-nowrap uppercase"
          >
            {c.name}
          </th>
        ))}
      </tr>
    </thead>
  )
}

function WeekRows({
  week,
  columns,
  open,
  onToggle,
}: {
  week: MonitoringWeek
  columns: ScorecardRow[]
  open: boolean
  onToggle: () => void
}): React.JSX.Element {
  return (
    <>
      <tr className="border-t border-zinc-200 bg-white">
        <th
          scope="rowgroup"
          colSpan={columns.length + 1}
          className={`${STICKY} px-3 py-1.5 text-left`}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex items-center gap-1 font-semibold text-zinc-900 hover:text-prominent-purple-700"
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            {week.label}
          </button>
        </th>
      </tr>
      {open &&
        week.dayIndexes.map((i) => (
          <Fragment key={i}>
            <ValueRow
              label={shortDay(columns[0]?.daily[i]?.day ?? '')}
              columns={columns}
              value={(c) => c.daily[i]?.total ?? 0}
            />
            <ValueRow
              label="Office Sales"
              columns={columns}
              value={(c) => c.daily[i]?.office ?? 0}
              tone="office"
            />
          </Fragment>
        ))}
      <ValueRow
        label="TOTAL"
        columns={columns}
        value={(c) => sum(c, week.dayIndexes, 'total')}
        tone="week"
      />
      <ValueRow
        label="OFFICE SALES"
        columns={columns}
        value={(c) => sum(c, week.dayIndexes, 'office')}
        tone="weekOffice"
      />
    </>
  )
}

const TONES = {
  plain: 'bg-white text-zinc-900',
  office: 'bg-prominent-purple-50 text-prominent-purple-800',
  week: 'bg-amber-50 font-semibold text-zinc-900',
  weekOffice: 'bg-amber-50 font-semibold text-prominent-purple-800',
  cumulative: 'bg-sky-50 font-semibold text-zinc-900',
  quota: 'bg-rose-50 font-semibold text-zinc-900',
} as const

function ValueRow({
  label,
  columns,
  value,
  tone = 'plain',
  format = peso,
}: {
  label: string
  columns: ScorecardRow[]
  value: (c: ScorecardRow) => number | null
  tone?: keyof typeof TONES
  format?: (n: number | null) => string
}): React.JSX.Element {
  return (
    <tr className={`border-t border-zinc-100 ${TONES[tone]}`}>
      <th scope="row" className={`${STICKY} px-3 py-1 text-left whitespace-nowrap ${TONES[tone]}`}>
        {label}
      </th>
      {columns.map((c) => (
        <td key={c.key} className="px-3 py-1 text-right tabular-nums">
          {format(value(c))}
        </td>
      ))}
    </tr>
  )
}

/** The period's total per column, against its quota — the scorecard's own figures. */
function SummaryRows({
  columns,
  weeks,
}: {
  columns: ScorecardRow[]
  weeks: MonitoringWeek[]
}): React.JSX.Element {
  const label = weeks.length > 1 ? `WEEK 1–${weeks.length}` : 'WEEK 1'
  return (
    <>
      <ValueRow label={label} columns={columns} value={(c) => c.total} tone="cumulative" />
      <ValueRow label="OFFICE SALES" columns={columns} value={(c) => c.office} tone="cumulative" />
      <ValueRow
        label="% OFFICE SALES"
        columns={columns}
        value={(c) => (c.total ? c.officeShare : null)}
        format={percent}
      />
      <ValueRow label="QUOTA" columns={columns} value={(c) => c.quota} tone="quota" />
      <ValueRow label="ACH RATE" columns={columns} value={(c) => c.achRate} format={percent} />
      <ValueRow label="BTS (Balance total sales)" columns={columns} value={(c) => c.bts} />
    </>
  )
}

function Comparisons({
  comparisons,
}: {
  comparisons: DailyMonitoring['comparisons']
}): React.JSX.Element | null {
  const shown = comparisons.filter((c) => c.hasData)
  if (!shown.length) return null
  return (
    <dl className="grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-xs">
      {shown.map((c) => (
        <Fragment key={c.key}>
          <dt className="font-semibold text-zinc-800">{c.label}</dt>
          <dd className="text-right text-zinc-900 tabular-nums">
            {c.total.toLocaleString('en-PH', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </dd>
        </Fragment>
      ))}
    </dl>
  )
}
