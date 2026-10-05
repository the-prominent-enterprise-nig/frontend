'use client'

import type {
  DailySalesMonitoringReport,
  SalesCategory,
} from '@/src/schema/pos/daily-sales-monitoring'
import { peso } from './form-model'

/**
 * Scenario 61 Part 3 — the client's DAILY SALES & COLLECTION MONITORING sheet.
 * It prints beside the collection report, in the page's print region.
 *
 * Sales only: per category, then Office/Agent and Cash
 * (COD)/Charge invoice — two more cuts of the same sales, each coming to
 * TOTAL SALES. No sign-offs: those are the collection report's.
 */

interface Props {
  report: DailySalesMonitoringReport
  /** False for the on-screen copy: it must not carry `print-sheet`, or the
   * print rules would force it visible and print the sheet twice. */
  printable?: boolean
}

interface CategoryGroup {
  name: string
  category?: SalesCategory
  subs?: { name: string; category: SalesCategory }[]
}

/** The client sheet's rows, in its own order. */
const CATEGORY_TREE: CategoryGroup[] = [
  { name: 'Appliances', category: 'APPLIANCES' },
  {
    name: 'Furniture',
    subs: [
      { name: '3E', category: 'FURNITURE_3E' },
      { name: 'Non-3E', category: 'FURNITURE_NON_3E' },
    ],
  },
  { name: 'Small items', category: 'SMALL_ITEMS' },
  {
    name: 'IT products',
    subs: [
      { name: 'Computers, laptops & accessories', category: 'IT_COMPUTER' },
      { name: 'Cellphones', category: 'IT_CELLPHONE' },
    ],
  },
  { name: 'Split type', category: 'SPLIT_TYPE' },
]

const COLUMN_HEAD =
  'border-b border-gray-900 pb-1.5 font-mono text-[10px] uppercase tracking-[0.09em] text-gray-500'
const GRID = 'grid grid-cols-[minmax(0,1fr)_130px] items-baseline gap-x-3.5'

export default function DailySalesMonitoringSheet({
  report,
  printable = true,
}: Props): React.JSX.Element {
  const { sales } = report
  return (
    <>
      <div
        className={`${printable ? 'print-sheet print-sheet-compact ' : ''}flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 print:rounded-none print:border-0`}
      >
        <SheetHeader report={report} />
        <CategoryTable sales={sales} />
        <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 print:grid-cols-2">
          <TieOut
            title="By channel"
            lines={[
              ['Office sales', sales.officeSales],
              ['Agent sales', sales.agentSales],
            ]}
          />
          <TieOut
            title="By invoice type"
            lines={[
              ['Cash invoice (COD)', sales.cashInvoice],
              ['Charge invoice', sales.chargeInvoice],
            ]}
          />
        </div>
      </div>
    </>
  )
}

function SheetHeader({ report }: { report: DailySalesMonitoringReport }): React.JSX.Element {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5 border-b-2 border-gray-900 pb-3.5">
      <div className="flex flex-col gap-1">
        <span className="text-lg font-semibold tracking-tight">
          Daily Sales &amp; Collection Monitoring
        </span>
        <span className="text-[12.5px] text-gray-700">
          Branch <strong>{report.branchName}</strong> · Business date{' '}
          <strong>{sheetDate(report.date)}</strong>
        </span>
      </div>
      <span className="font-mono text-[11px] text-gray-500">{sheetReference(report)}</span>
    </header>
  )
}

function CategoryTable({
  sales,
}: {
  sales: DailySalesMonitoringReport['sales']
}): React.JSX.Element {
  const amount = (c: SalesCategory): number => sales.byCategory[c] ?? 0

  return (
    <div className="flex flex-col">
      <div className={`${GRID} ${COLUMN_HEAD}`}>
        <span>For sales · per category</span>
        <span className="text-right">Amount</span>
      </div>
      {CATEGORY_TREE.map((group) => (
        <div key={group.name}>
          <CategoryRow
            label={group.name}
            amount={groupSum(group, amount)}
            emphasis={group.subs ? 'group' : 'none'}
          />
          {group.subs?.map((sub) => (
            <CategoryRow key={sub.category} label={sub.name} amount={amount(sub.category)} sub />
          ))}
        </div>
      ))}
      <CategoryRow label="Total sales" amount={sales.totalSales} emphasis="total" />
    </div>
  )
}

function groupSum(group: CategoryGroup, of: (c: SalesCategory) => number): number {
  if (group.category) return of(group.category)
  return (group.subs ?? []).reduce((sum, s) => sum + of(s.category), 0)
}

interface CategoryRowProps {
  label: string
  amount: number
  sub?: boolean
  /** 'group' bolds a heading row's amount; 'total' is the TOTAL SALES line. */
  emphasis?: 'none' | 'group' | 'total'
}

function CategoryRow({
  label,
  amount,
  sub,
  emphasis = 'none',
}: CategoryRowProps): React.JSX.Element {
  const total = emphasis === 'total'
  const rowClass = total
    ? 'border-t-[1.5px] border-gray-900 pt-2.5 pb-1 print-tight-total'
    : `border-b border-gray-100 py-1.5 print-tight ${sub ? 'pl-5.5' : ''}`
  const labelClass = total
    ? 'text-[13px] font-semibold'
    : sub
      ? 'text-[12.5px] text-gray-700'
      : 'text-[13px] font-medium'

  return (
    <div className={`${GRID} ${rowClass}`}>
      <span className={labelClass}>{label}</span>
      <span
        className={`text-right font-mono tabular-nums ${total ? 'text-sm' : 'text-[12.5px]'} ${
          emphasis !== 'none' ? 'font-semibold' : ''
        } ${amount ? '' : 'text-gray-400'}`}
      >
        {amount ? peso(amount) : '—'}
      </span>
    </div>
  )
}

function TieOut({ title, lines }: { title: string; lines: [string, number][] }): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <span className={COLUMN_HEAD}>{title}</span>
      {lines.map(([name, amount]) => (
        <div
          key={name}
          className="print-tight flex justify-between gap-3 border-b border-gray-100 py-1.75"
        >
          <span className="text-[12.5px]">{name}</span>
          <span className="font-mono text-[12.5px] tabular-nums">{peso(amount)}</span>
        </div>
      ))}
    </div>
  )
}

/** '2026-09-21' -> '09/21/26', the way the branch writes it on the paper. */
function sheetDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${month}/${day}/${year.slice(2)}`
}

/** DSM-BAGO-20260929 — ties a printout back to its branch and day. */
function sheetReference(report: DailySalesMonitoringReport): string {
  const branch = report.branchName
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `DSM-${branch || 'ALL'}-${report.date.replaceAll('-', '')}`
}
