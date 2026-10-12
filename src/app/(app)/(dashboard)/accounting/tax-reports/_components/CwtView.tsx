'use client'

import { useEffect } from 'react'
import { TaxReports, type TaxReportMeta, type TaxReportQuery } from '@/src/libs/data/TaxReportsData'
import {
  Chip,
  DocCell,
  EmptyRow,
  EntryLink,
  FlagChips,
  HEAD,
  Money,
  StatCard,
  TH,
  THR,
  TableShell,
  useTaxReport,
} from './ui'

// Creditable WHT Receivable Schedule — what customers withheld from NIG at
// collection, with the BIR 2307 certificate each one is waiting on. A
// certificate that has not come is the thing to chase: it is what makes the
// credit claimable against NIG's income tax.
export default function CwtView({
  query,
  onMeta,
}: {
  query: TaxReportQuery
  onMeta: (m: TaxReportMeta | null) => void
}) {
  const { data, loading, error } = useTaxReport(TaxReports.cwtSchedule, query)
  useEffect(() => onMeta(data?.meta ?? null), [data, onMeta])

  return (
    <div>
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          testId="stat-cwt-withheld"
          label="Withheld by customers"
          value={<Money value={data?.totals.withheld} />}
        />
        <StatCard
          testId="stat-cwt-pending"
          label="2307 not received"
          value={<Money value={data?.totals.pendingAmount} />}
          hint={`${data?.totals.pendingCount ?? 0} certificate${data?.totals.pendingCount === 1 ? '' : 's'} to chase`}
          tone={data && data.totals.pendingCount > 0 ? 'red' : 'green'}
        />
        <StatCard
          testId="stat-cwt-received"
          label="2307 received"
          value={<Money value={data?.totals.receivedAmount} />}
          tone="green"
        />
      </div>

      <h2 className="mb-2 text-sm font-semibold text-prominent-purple-900">By customer</h2>
      <div className="mb-6">
        <TableShell testId="cwt-summary-table">
          <thead className={HEAD}>
            <tr>
              <th className={TH}>Customer</th>
              <th className={TH}>TIN</th>
              <th className={THR}>Entries</th>
              <th className={THR}>Tax withheld</th>
              <th className={THR}>2307 not received</th>
              <th className={THR}>2307 received</th>
            </tr>
          </thead>
          <tbody>
            {!data || data.summary.length === 0 ? (
              <EmptyRow
                cols={6}
                loading={loading}
                text="No customer withheld tax in this period."
              />
            ) : (
              data.summary.map((s, i) => (
                <tr
                  key={`${s.customerId ?? s.customerName}-${i}`}
                  data-testid="cwt-summary-row"
                  className="border-t border-gray-100"
                >
                  <td className="px-3 py-2">{s.customerName}</td>
                  <td className="px-3 py-2">{s.tin ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.rows}</td>
                  <td className="px-3 py-2 text-right">
                    <Money value={s.withheld} bold />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={s.pendingAmount} zeroAsDash />
                    {s.pendingCount > 0 && (
                      <div className="text-[11px] text-red-700">{s.pendingCount} to chase</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={s.receivedAmount} zeroAsDash />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-prominent-purple-900">Collections</h2>
      <TableShell testId="cwt-table">
        <thead className={HEAD}>
          <tr>
            <th className={TH}>Date</th>
            <th className={TH}>Collection</th>
            <th className={TH}>Invoice</th>
            <th className={TH}>Customer</th>
            <th className={TH}>Branch</th>
            <th className={TH}>Certificate</th>
            <th className={TH}>ATC</th>
            <th className={TH}>Tax period</th>
            <th className={THR}>Taxable base</th>
            <th className={THR}>Tax withheld</th>
            <th className={THR}>Certificate amount</th>
            <th className={TH}>Notes</th>
            <th className={TH}>Entry</th>
          </tr>
        </thead>
        <tbody>
          {!data || data.rows.length === 0 ? (
            <EmptyRow cols={13} loading={loading} text="No customer withheld tax in this period." />
          ) : (
            data.rows.map((r, i) => (
              <tr
                key={`${r.journalEntryId}-${r.paymentId}-${i}`}
                data-testid="cwt-row"
                className="border-t border-gray-100 align-top"
              >
                <td className="whitespace-nowrap px-3 py-2">{r.date}</td>
                <td className="px-3 py-2">
                  <DocCell
                    documentType={r.documentType}
                    documentNo={r.collectionRef ?? r.documentNo}
                    documentId={r.documentId}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {r.invoiceNo ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2">
                  {r.customerName}
                  {r.tin && <div className="text-[11px] text-gray-500">TIN {r.tin}</div>}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{r.branchName}</td>
                <td className="px-3 py-2">
                  {r.certificateStatus === 'received' ? (
                    <>
                      <Chip tone="green">Received</Chip>
                      <div className="mt-0.5 font-mono text-[11px] text-gray-500">
                        {r.certificateNo}
                      </div>
                    </>
                  ) : r.certificateStatus === 'pending' ? (
                    <>
                      <Chip tone="red">Not received</Chip>
                      {r.daysOutstanding != null && (
                        <div className="mt-0.5 text-[11px] text-gray-500">
                          {r.daysOutstanding} days
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.atc ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {r.taxPeriod ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.taxableBase} zeroAsDash />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.withheld} bold />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.certificateAmount} zeroAsDash />
                </td>
                <td className="px-3 py-2">
                  <FlagChips flags={r.flags.filter((f) => f !== 'missing_certificate')} />
                </td>
                <td className="px-3 py-2">
                  <EntryLink journalEntryId={r.journalEntryId} journalRef={r.journalRef} />
                </td>
              </tr>
            ))
          )}
        </tbody>
        {data && data.rows.length > 0 && (
          <tfoot>
            <tr
              data-testid="cwt-total"
              className="border-t-2 border-gray-200 bg-gray-50 font-semibold"
            >
              <td className="px-3 py-2" colSpan={9}>
                Total · {data.totals.rows} rows
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={data.totals.withheld} bold />
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        )}
      </TableShell>
    </div>
  )
}
