'use client'

import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import TablePagination from '@/src/components/common/TablePagination'
import type { SalesLine, SalesReportsParams } from '@/src/schema/pos/sales-reports'
import { getSalesLines } from '../_actions/get-sales-reports'
import { money } from './SalesStatCards'

/**
 * Scenario 85 Part 2 — the Sales Report tab: "every unit sold, as in the
 * sales export". Paged server-side (a twelve-month range is thousands of
 * units); the totals cover every unit the filters match, not just this page.
 * The Excel export (header button) carries the same column set. Credit is an
 * installment sale's PN value; SMI the Commissions - SMI recorded for the sale
 * in Expenses (2026-11-09). Unit Cost is left out for a branch-tied user, who never
 * gets it from the API either (NIG UAT 2026-11-09).
 */

const PAGE_SIZE = 50

type Column = { header: string; cell: (l: SalesLine) => string | number; numeric?: boolean }

const COLUMNS: Column[] = [
  { header: 'Date', cell: (l) => l.day },
  { header: 'Month', cell: (l) => l.day.slice(0, 7) },
  { header: 'Invoice Type', cell: (l) => l.invoiceType },
  { header: 'Classification', cell: (l) => l.classification },
  { header: 'Branch', cell: (l) => l.branchName },
  { header: 'SI No.', cell: (l) => l.salesInvoiceNumber || l.transactionNumber },
  { header: 'Firstname', cell: (l) => l.customerFirstName },
  { header: 'Lastname', cell: (l) => l.customerLastName },
  { header: 'Type', cell: (l) => l.typeName },
  { header: 'Group', cell: (l) => l.groupName },
  { header: 'Subgroup', cell: (l) => l.subgroupName },
  { header: 'Brand', cell: (l) => l.brandName },
  { header: 'Model No.', cell: (l) => l.modelNumber },
  { header: 'Serial No.', cell: (l) => l.serialNumbers },
  { header: 'Qty', cell: (l) => l.quantity, numeric: true },
  { header: 'LCP', cell: (l) => money(l.lcp), numeric: true },
  {
    header: 'Unit Cost',
    cell: (l) => (l.unitCost == null ? '' : money(l.unitCost)),
    numeric: true,
  },
  { header: 'Price Used', cell: (l) => l.priceUseName },
  { header: 'Agent', cell: (l) => l.agentName },
  { header: 'Commission', cell: (l) => (l.commission ? money(l.commission) : ''), numeric: true },
  // Credit: an installment sale's PN value (MI × term). SMI: the Commissions -
  // SMI recorded for the sale in Expenses. Same as the Excel; blank if none.
  { header: 'Credit', cell: (l) => (l.credit == null ? '' : money(l.credit)), numeric: true },
  { header: 'SMI', cell: (l) => (l.smi == null ? '' : money(l.smi)), numeric: true },
]

function columnsFor(showCost: boolean): Column[] {
  return showCost ? COLUMNS : COLUMNS.filter((c) => c.header !== 'Unit Cost')
}

export default function SalesReportTab({
  params,
  showCost,
}: {
  params: SalesReportsParams
  /** False for a branch-tied user. */
  showCost: boolean
}): React.JSX.Element {
  const columns = columnsFor(showCost)
  // Page 7 of the old result means nothing against new filters.
  const filterKey = JSON.stringify(params)
  const [paging, setPaging] = useState({ key: filterKey, page: 1 })
  const page = paging.key === filterKey ? paging.page : 1

  const query = useQuery({
    queryKey: ['pos-sales-report-lines', params, page],
    queryFn: async () => {
      const res = await getSalesLines({ ...params, page, limit: PAGE_SIZE })
      if (!res.success || !res.data) throw new Error(res.error ?? 'Could not load sales')
      return res.data
    },
    placeholderData: keepPreviousData,
  })
  const data = query.data

  return (
    <section
      role="tabpanel"
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4"
    >
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Sales Report</h2>
        <p className="text-xs text-zinc-500">
          Every unit sold, as in the sales export. Use Export to Excel to copy it. The total is
          gross sales (the LCP column).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:max-w-xl">
        <Total label="Total Sales (gross)" value={data ? money(data.totals.totalGross) : '…'} />
        <Total label="Units sold" value={data ? data.totals.units.toLocaleString('en-PH') : '…'} />
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-lg border border-zinc-200">
        <table className="min-w-max text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.header}
                  scope="col"
                  className={`border-b border-r border-yellow-300 bg-yellow-200 px-3 py-2 font-semibold whitespace-nowrap text-zinc-900 ${c.numeric ? 'text-right' : 'text-left'}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            <StateRow query={query} empty={data?.total === 0} colSpan={columns.length} />
            {data?.rows.map((line, i) => (
              <tr
                key={`${line.transactionId}-${i}`}
                className={line.isRefund ? 'bg-red-50/60' : 'hover:bg-zinc-50'}
              >
                {columns.map((c) => (
                  <td
                    key={c.header}
                    className={`border-r border-zinc-100 px-3 py-1.5 whitespace-nowrap text-zinc-800 ${c.numeric ? 'text-right tabular-nums' : ''}`}
                  >
                    {c.cell(line)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <TablePagination
          page={page}
          pageCount={Math.max(1, Math.ceil(data.total / PAGE_SIZE))}
          onPageChange={(p) => setPaging({ key: filterKey, page: p })}
          pageStart={(page - 1) * PAGE_SIZE}
          pageSize={data.rows.length}
          totalItems={data.total}
          noun="unit"
        />
      )}
      <p className="text-xs text-zinc-500">
        Refunds show in red, with negative quantity and LCP, on the day they were made.
      </p>
    </section>
  )
}

function StateRow({
  query,
  empty,
  colSpan,
}: {
  query: { isLoading: boolean; isError: boolean }
  empty: boolean
  colSpan: number
}): React.JSX.Element | null {
  const message = query.isLoading
    ? 'Loading…'
    : query.isError
      ? 'Could not load sales for these filters.'
      : empty
        ? 'No sales for these filters.'
        : null
  if (!message) return null
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-zinc-500">
        {message}
      </td>
    </tr>
  )
}

function Total({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-zinc-200 px-4 py-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900 tabular-nums">{value}</div>
    </div>
  )
}
