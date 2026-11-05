'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Scorecard, ScorecardFigures, ScorecardRow } from '@/src/schema/pos/sales-reports'
import { STATUS_STYLE, peso, percent } from './scorecard-format'

/**
 * Scenario 85 Part 5 — the scorecard table: one row per branch (and the AC
 * Unit + Services line), sorted by Ach Rate, then Total Branches and Grand
 * Total. Clicking a branch opens its day-by-day sales for the month.
 */

const HEADERS = [
  'Branch',
  'Total Sales',
  'Office Sales',
  '% Office',
  'Quota',
  'Ach Rate',
  'BTS',
  'Status',
]

export default function ScorecardTable({ card }: { card: Scorecard }): React.JSX.Element {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="w-full min-w-[56rem] text-xs">
        <thead className="bg-zinc-50 text-[11px] tracking-wide text-zinc-500 uppercase">
          <tr>
            {HEADERS.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-3 py-2 ${i === 0 ? 'text-left' : i === 5 ? 'w-56 text-left' : 'text-right'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {card.rows.map((row) => (
            <Fragment key={row.key}>
              <FiguresRow
                label={row.name}
                figures={row}
                pace={card.period.pace}
                expanded={open === row.key}
                onToggle={() => setOpen(open === row.key ? null : row.key)}
              />
              {open === row.key && <DailyRow row={row} />}
            </Fragment>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-zinc-200 bg-zinc-50">
          <FiguresRow
            label="Total Branches"
            figures={card.totalBranches}
            pace={card.period.pace}
            strong
          />
          <FiguresRow
            label="Grand Total"
            figures={card.grandTotal}
            pace={card.period.pace}
            strong
          />
        </tfoot>
      </table>
    </div>
  )
}

function FiguresRow({
  label,
  figures,
  pace,
  strong = false,
  expanded,
  onToggle,
}: {
  label: string
  figures: ScorecardFigures
  pace: number
  strong?: boolean
  expanded?: boolean
  onToggle?: () => void
}): React.JSX.Element {
  const num = `px-3 py-2 text-right tabular-nums ${strong ? 'font-semibold' : ''} text-zinc-900`
  return (
    <tr className={onToggle ? 'hover:bg-zinc-50' : ''}>
      <th scope="row" className="px-3 py-2 text-left font-semibold text-zinc-900">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex items-center gap-1 text-left hover:text-prominent-purple-700"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            {label}
          </button>
        ) : (
          label
        )}
      </th>
      <td className={num}>{peso(figures.total)}</td>
      <td className={num}>{peso(figures.office)}</td>
      <td className={num}>{figures.total ? percent(figures.officeShare) : '—'}</td>
      <td className={num}>{peso(figures.quota)}</td>
      <td className="px-3 py-2">
        <AchBar figures={figures} pace={pace} />
      </td>
      <td className={num}>{peso(figures.bts)}</td>
      <td className="px-3 py-2 text-right">
        <StatusPill figures={figures} />
      </td>
    </tr>
  )
}

/** The bar fills to the Ach Rate (capped at the track); the tick marks today's pace. */
function AchBar({ figures, pace }: { figures: ScorecardFigures; pace: number }): React.JSX.Element {
  if (figures.achRate === null) {
    return <span className="text-zinc-500">No quota</span>
  }
  const fill = figures.status ? STATUS_STYLE[figures.status].bar : 'bg-zinc-400'
  return (
    <span className="flex items-center gap-2">
      <span className="relative h-2.5 flex-1 rounded-sm bg-zinc-100">
        {/* Data-driven widths/positions: the Ach Rate and the pace tick. */}
        <span
          className={`absolute inset-y-0 left-0 rounded-sm ${fill}`}
          style={{ width: `${Math.min(1, figures.achRate) * 100}%` }}
        />
        <span
          aria-hidden
          className="absolute -top-1 -bottom-1 w-0.5 bg-zinc-900"
          style={{ left: `${pace * 100}%` }}
        />
      </span>
      <span className="w-10 text-right font-semibold text-zinc-900 tabular-nums">
        {percent(figures.achRate)}
      </span>
    </span>
  )
}

function StatusPill({ figures }: { figures: ScorecardFigures }): React.JSX.Element | null {
  if (!figures.status) return null
  const style = STATUS_STYLE[figures.status]
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${style.pill}`}
    >
      {style.label}
    </span>
  )
}

function DailyRow({ row }: { row: ScorecardRow }): React.JSX.Element {
  return (
    <tr className="bg-zinc-50/70">
      <td colSpan={HEADERS.length} className="px-3 py-3">
        <p className="mb-2 text-[11px] font-semibold text-zinc-600">
          {row.name} — daily sales, office sales under each day
        </p>
        <div className="overflow-x-auto">
          <table className="text-[11px]">
            <tbody>
              <tr>
                {row.daily.map((d) => (
                  <th
                    key={d.day}
                    scope="col"
                    className="px-2 pb-1 text-right font-medium text-zinc-500"
                  >
                    {Number(d.day.slice(8))}
                  </th>
                ))}
              </tr>
              <tr>
                {row.daily.map((d) => (
                  <td key={d.day} className="px-2 text-right tabular-nums text-zinc-900">
                    {d.total ? peso(d.total) : '·'}
                  </td>
                ))}
              </tr>
              <tr>
                {row.daily.map((d) => (
                  <td key={d.day} className="px-2 text-right tabular-nums text-zinc-500">
                    {d.office ? peso(d.office) : ''}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  )
}
