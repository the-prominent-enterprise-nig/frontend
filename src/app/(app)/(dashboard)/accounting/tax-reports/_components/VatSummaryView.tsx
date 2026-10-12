'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TaxReports, type TaxReportMeta, type TaxReportQuery } from '@/src/libs/data/TaxReportsData'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { manilaToday } from '@/src/libs/tax/tax-reports'
import { EmptyRow, HEAD, Money, StatCard, TH, THR, TableShell, useTaxReport } from './ui'

// VAT Summary by Period — one row per month: what was sold, the Output VAT it
// carried, the Input VAT claimed, and the net. The figures are the ledger's, so
// they tie to the General Ledger; "no source document" says how much of them no
// sale or purchase explains.
export default function VatSummaryView({
  query,
  onMeta,
  canClose,
}: {
  query: TaxReportQuery
  onMeta: (m: TaxReportMeta | null) => void
  canClose: boolean
}) {
  const { data, loading, error } = useTaxReport(TaxReports.vatSummary, query)
  useEffect(() => onMeta(data?.meta ?? null), [data, onMeta])

  const total = data?.total
  const net = total?.netVat ?? 0
  const through = query.endDate < manilaToday() ? query.endDate : manilaToday()

  return (
    <div>
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          testId="stat-output-vat"
          label="Output VAT"
          value={<Money value={total?.outputVat} />}
        />
        <StatCard
          testId="stat-input-vat"
          label="Input VAT"
          value={<Money value={total?.inputVat} />}
        />
        <StatCard
          testId="stat-net-vat"
          label={net >= 0 ? 'Net VAT payable' : 'Net VAT creditable'}
          value={<Money value={Math.abs(net)} />}
          hint="Output VAT less Input VAT for the period"
          tone={net >= 0 ? 'amber' : 'green'}
        />
      </div>

      <TableShell testId="vat-summary-table">
        <thead className={HEAD}>
          <tr>
            <th className={TH}>Month</th>
            <th className={THR}>VATable sales</th>
            <th className={THR}>Zero-rated</th>
            <th className={THR}>Exempt</th>
            <th className={THR}>Other / not classified</th>
            <th className={THR}>Output VAT</th>
            <th className={THR}>Input VAT claimable</th>
            <th className={THR}>Capital goods</th>
            <th className={THR}>Input VAT other</th>
            <th className={THR}>Input VAT</th>
            <th className={THR}>Net VAT</th>
            {data?.filters.settledShown && <th className={THR}>Settled to VAT Payable</th>}
          </tr>
        </thead>
        <tbody>
          {!data || data.months.length === 0 ? (
            <EmptyRow cols={12} loading={loading} text="No VAT in this period." />
          ) : (
            <>
              {data.months.map((m) => (
                <tr
                  key={m.month}
                  data-testid={`vat-month-${m.month}`}
                  className="border-t border-gray-100"
                >
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    {m.label}
                    {(m.start.slice(8) !== '01' || m.end !== lastDay(m.month)) && (
                      <div className="text-[11px] font-normal text-gray-500">
                        {m.start} to {m.end}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={m.vatableSales} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={m.zeroRatedSales} zeroAsDash />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={m.exemptSales} zeroAsDash />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={m.otherSales} zeroAsDash />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={m.outputVat} bold />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={m.inputVatClaimable} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={m.inputVatCapital} zeroAsDash />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={m.inputVatOther} zeroAsDash />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={m.inputVat} bold />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={m.netVat} bold />
                  </td>
                  {data.filters.settledShown && (
                    <td className="px-3 py-2 text-right">
                      <Money value={m.settled?.payable} zeroAsDash />
                    </td>
                  )}
                </tr>
              ))}
              {data.months.length > 1 && total && (
                <tr
                  data-testid="vat-total"
                  className="border-t-2 border-gray-200 bg-gray-50 font-semibold"
                >
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">
                    <Money value={total.vatableSales} bold />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={total.zeroRatedSales} zeroAsDash bold />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={total.exemptSales} zeroAsDash bold />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={total.otherSales} zeroAsDash bold />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={total.outputVat} bold />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={total.inputVatClaimable} bold />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={total.inputVatCapital} zeroAsDash bold />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={total.inputVatOther} zeroAsDash bold />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={total.inputVat} bold />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={total.netVat} bold />
                  </td>
                  {data.filters.settledShown && (
                    <td className="px-3 py-2 text-right">
                      <Money value={total.settled?.payable} zeroAsDash bold />
                    </td>
                  )}
                </tr>
              )}
            </>
          )}
        </tbody>
      </TableShell>

      {total &&
        (Math.abs(total.outputAdjustments) >= 0.005 ||
          Math.abs(total.inputAdjustments) >= 0.005) && (
          <p data-testid="vat-adjustments" className="mt-2 text-[12px] text-amber-800">
            Of the Output VAT, {fmtMoney(total.outputAdjustments)}, and of the Input VAT,{' '}
            {fmtMoney(total.inputAdjustments)}, is in entries no sale or purchase explains (manual
            journal entries). They are in the totals because the ledger carries them.
          </p>
        )}

      {data?.unsettled ? (
        <div
          data-testid="vat-unsettled"
          className="mt-5 rounded-lg border border-gray-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold text-prominent-purple-900">
            Still in the accounts at {data.meta.endDate}
          </h2>
          <p className="mt-0.5 text-[12px] text-gray-500">
            What a VAT settlement through that day would clear: the company&rsquo;s balances, not
            the period&rsquo;s activity.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <StatCard
              label="Output VAT"
              value={<Money value={data.unsettled.output} />}
              tone="gray"
            />
            <StatCard
              label="Input VAT"
              value={<Money value={data.unsettled.input} />}
              tone="gray"
            />
            <StatCard
              label={data.unsettled.net >= 0 ? 'Net payable' : 'Net creditable'}
              value={<Money value={Math.abs(data.unsettled.net)} />}
              tone="gray"
            />
            <StatCard
              label="In VAT Payable now"
              value={<Money value={data.unsettled.payable} />}
              tone="gray"
            />
          </div>
          {canClose && (
            <Link
              href={`/accounting/tax-closing/vat/new?asOf=${through}`}
              className="mt-3 inline-block rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
            >
              Settle VAT through {through}
            </Link>
          )}
        </div>
      ) : (
        data && (
          <p className="mt-3 text-[12px] text-gray-500">
            The closing columns are left out when the report is narrowed to a branch or a tax code:
            a settlement belongs to the company.
          </p>
        )
      )}
    </div>
  )
}

/** The last day of a 'YYYY-MM' month, YYYY-MM-DD. */
function lastDay(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}
