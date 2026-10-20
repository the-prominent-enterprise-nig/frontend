'use client'

import type { DailyCollectionRollup as Rollup } from '@/src/schema/pos/daily-collection'
import { formatFormDate, peso } from './form-model'
import { money, openNote, STATUS_LABEL } from './DailyCollectionRollup'

/**
 * Scenario 74 — the all-branches Daily Collection on paper ("make the daily
 * collection report printable"). A branch's own form already prints; the
 * roll-up, which is what a Business Owner opens by default, had nothing to
 * print at all.
 *
 * The same figures as the screen's roll-up, in the printed form's style —
 * black on white, ruled cells — so it reads as part of the same set of papers.
 * Status is spelled out in words rather than as a coloured chip, which a
 * black-and-white printer would lose. A branch that has not filed shows a
 * dash, exactly as on screen: the API withholds its figures until it does.
 */

const CELL = 'border border-black px-2 py-1 leading-tight'
const HEAD = `${CELL} text-center text-[10px] font-bold uppercase`
const NUM = `${CELL} text-right tabular-nums`

interface Props {
  rollup: Rollup
  companyName: string
}

export default function DailyCollectionRollupPrintSheet({
  rollup,
  companyName,
}: Props): React.JSX.Element {
  const { totals } = rollup

  return (
    <div className="print-sheet bg-white p-6 text-black" data-testid="rollup-print-sheet">
      <header className="mb-2 text-[10.5px] font-bold uppercase leading-snug">
        {companyName && <p>{companyName}</p>}
        <p>Daily Collection Report — All branches</p>
        <p>{formatFormDate(rollup.date)}</p>
      </header>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={`${HEAD} text-left`}>Branch</th>
            <th className={HEAD}>Entries</th>
            <th className={HEAD}>Total collection</th>
            <th className={HEAD}>Cash counted</th>
            <th className={HEAD}>Status</th>
            <th className={`${HEAD} text-left`}>Note</th>
          </tr>
        </thead>
        <tbody>
          {rollup.branches.map((branch) => (
            <tr key={branch.branchId}>
              <td className={`${CELL} font-semibold`}>{branch.branchName}</td>
              <td className={NUM}>{branch.entryCount}</td>
              <td className={NUM}>{money(branch.grandTotalCollection)}</td>
              <td className={NUM}>{money(branch.cashCounted)}</td>
              <td className={`${CELL} text-center`}>{STATUS_LABEL[branch.status]}</td>
              <td className={CELL}>{openNote(branch)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td className={CELL}>ALL BRANCHES</td>
            <td className={NUM}>{totals.entryCount}</td>
            <td className={NUM}>{peso(totals.grandTotalCollection)}</td>
            <td className={NUM}>{peso(totals.cashCounted)}</td>
            <td className={`${CELL} text-center`} colSpan={2}>
              {totals.filedCount} of {totals.tradingCount} trading branches filed
            </td>
          </tr>
        </tfoot>
      </table>

      {totals.filedCount < totals.tradingCount && (
        <p className="mt-2 text-[10px] italic">
          Totals cover the branches that have filed. A dash means the branch has not filed yet.
        </p>
      )}
    </div>
  )
}
