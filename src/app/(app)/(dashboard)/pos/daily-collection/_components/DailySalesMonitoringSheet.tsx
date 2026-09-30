'use client'

import type { DailySalesMonitoringReport } from '@/src/schema/pos/daily-sales-monitoring'
import { peso } from './form-model'

/**
 * Scenario 61 Part 3 — a facsimile of the client's paper DAILY SALES &
 * COLLECTION MONITORING sheet (Alimodian sample, 9/23/26), and the page's one
 * printable region while it is on screen.
 *
 * Sales only, per the client's format: per category, then Office/Agent and
 * Cash (COD)/Charge invoice — three cuts of the same sales, each coming to
 * TOTAL SALES. The collections themselves — and the Prepared by / Checked by
 * sign-offs — are the Daily Collection Report's; this sheet has neither.
 */

interface Props {
  report: DailySalesMonitoringReport
}

const SECTION = 'mt-5 text-[12px] font-bold uppercase leading-snug text-black'

export default function DailySalesMonitoringSheet({ report }: Props): React.JSX.Element {
  return (
    <>
      <PortraitPrintPage />
      <div className="print-sheet print-sheet-portrait rounded-2xl border border-gray-200 bg-white p-8 print:rounded-none print:border-0">
        <div className="mx-auto max-w-[640px] text-black">
          <SheetHeader report={report} />
          <SalesHalf sales={report.sales} />
        </div>
      </div>
    </>
  )
}

/**
 * Prints the page A4 portrait with no margin — the wide ledgers keep the
 * landscape default from globals.css. A <style> element because an @page rule
 * cannot be scoped by selector or expressed as a utility class; it exists only
 * while this sheet is mounted, and comes after globals.css so it wins. The
 * zero margin is what stops the browser printing its header/footer (URL,
 * title, date); `.print-sheet-portrait` pads the sheet back in.
 */
function PortraitPrintPage(): React.JSX.Element {
  return <style>{'@media print { @page { size: A4 portrait; margin: 0; } }'}</style>
}

function SheetHeader({ report }: Props): React.JSX.Element {
  return (
    <header className="text-[12px] font-bold uppercase leading-relaxed">
      <p className="text-[14px]">Daily Sales &amp; Collection Monitoring</p>
      <p>
        Branch: <span className="font-semibold normal-case">{report.branchName}</span>
      </p>
      <p>
        Date: <span className="font-semibold">{sheetDate(report.date)}</span>
      </p>
    </header>
  )
}

function SalesHalf({ sales }: { sales: DailySalesMonitoringReport['sales'] }): React.JSX.Element {
  const c = sales.byCategory
  return (
    <section>
      <p className={SECTION}>
        For sales:
        <br />
        Per categories
      </p>
      <div className="mt-2">
        <Line label="Appliances" amount={c.APPLIANCES} />
        <Line label="Furnitures" />
        <Line label="A: 3E" amount={c.FURNITURE_3E} sub />
        <Line label="B: Non-3E" amount={c.FURNITURE_NON_3E} sub />
        <Line label="Small items" amount={c.SMALL_ITEMS} />
        <Line label="I.T products" />
        <Line label="A: Comp/Laptop/Accs." amount={c.IT_COMPUTER} sub />
        <Line label="B: Cellphone" amount={c.IT_CELLPHONE} sub />
        <Line label="Split type" amount={c.SPLIT_TYPE} />
        <Line label="Office sales" amount={sales.officeSales} gap />
        <Line label="Agent sales" amount={sales.agentSales} />
        <Line label="Total sales" amount={sales.totalSales} strong />
        <Line label="Cash invoice (COD)" amount={sales.cashInvoice} gap />
        <Line label="Charge invoice" amount={sales.chargeInvoice} />
      </div>
    </section>
  )
}

/** A bucket's total, then each provider behind it when there is more than
 * one — "BPI/BDO SWIPE" is one row on paper but two settlements at the bank. */

interface LineProps {
  label: string
  /** Omitted for a heading row whose figures sit on its A/B sub-rows. */
  amount?: number
  sub?: boolean
  strong?: boolean
  /** A blank line above, where the paper sheet leaves one between blocks. */
  gap?: boolean
}

function Line({ label, amount, sub, strong, gap }: LineProps): React.JSX.Element {
  return (
    <div
      className={`flex items-end justify-between gap-6 text-[12px] uppercase ${gap ? 'mt-3' : ''}`}
    >
      <span className={`${sub ? 'pl-24' : 'pl-12'} ${strong ? 'font-bold' : 'font-semibold'}`}>
        {label}
        {sub ? '' : ':'}
      </span>
      {amount !== undefined && (
        <span
          className={`min-w-[180px] border-b border-black pb-0.5 text-right tabular-nums ${
            strong ? 'font-bold' : ''
          }`}
        >
          {amount === 0 ? '—' : peso(amount)}
        </span>
      )}
    </div>
  )
}

/** '2026-09-21' -> '09/21/26', the way the branch writes it on the paper. */
function sheetDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${month}/${day}/${year.slice(2)}`
}
