'use client'

import { useEffect } from 'react'
import { TaxReports, type TaxReportMeta, type TaxReportQuery } from '@/src/libs/data/TaxReportsData'
import { OUTPUT_BUCKET_LABEL, OUTPUT_BUCKET_TONE } from '@/src/libs/tax/tax-reports'
import {
  Chip,
  DocCell,
  EmptyRow,
  EntryLink,
  FlagChips,
  HEAD,
  Money,
  SettledCell,
  StatCard,
  TH,
  THR,
  TableShell,
  useTaxReport,
} from './ui'

// Output VAT Detail — every sale and invoice in the period with the class it
// was sold under, its base and the VAT the ledger carries for it. A zero-rated
// or exempt sale posts no VAT line, so it is listed from its document with a
// zero: a sales listing that left it out would not reconcile to the sales reports.
export default function OutputVatView({
  query,
  onMeta,
}: {
  query: TaxReportQuery
  onMeta: (m: TaxReportMeta | null) => void
}) {
  const { data, loading, error } = useTaxReport(TaxReports.outputVat, query)
  useEffect(() => onMeta(data?.meta ?? null), [data, onMeta])

  return (
    <div>
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div data-testid="output-summary" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(data?.summary ?? []).map((s) => (
          <StatCard
            key={s.bucket}
            testId={`class-${s.bucket}`}
            label={`${OUTPUT_BUCKET_LABEL[s.bucket]} · ${s.documents}`}
            value={<Money value={s.outputVat} />}
            hint={
              <span>
                Sales{' '}
                <Money value={s.vatableSales + s.zeroRatedSales + s.exemptSales + s.otherSales} />
              </span>
            }
            tone={s.bucket === 'UNCLASSIFIED' ? 'red' : 'purple'}
          />
        ))}
        {data && data.summary.length === 0 && (
          <div className="text-sm text-gray-500">No sales in this period.</div>
        )}
      </div>

      <TableShell testId="output-vat-table">
        <thead className={HEAD}>
          <tr>
            <th className={TH}>Date</th>
            <th className={TH}>Document</th>
            <th className={TH}>Invoice / OR no.</th>
            <th className={TH}>Customer</th>
            <th className={TH}>Branch</th>
            <th className={TH}>Class</th>
            <th className={THR}>VATable</th>
            <th className={THR}>Zero-rated</th>
            <th className={THR}>Exempt</th>
            <th className={THR}>Other</th>
            <th className={THR}>Output VAT</th>
            <th className={THR}>Gross</th>
            <th className={TH}>Notes</th>
            <th className={TH}>Settled</th>
            <th className={TH}>Entry</th>
          </tr>
        </thead>
        <tbody>
          {!data || data.rows.length === 0 ? (
            <EmptyRow cols={15} loading={loading} text="No sales or invoices in this period." />
          ) : (
            data.rows.map((r, i) => (
              <tr
                key={`${r.journalEntryId ?? r.documentId}-${i}`}
                data-testid="output-row"
                className="border-t border-gray-100 align-top"
              >
                <td className="whitespace-nowrap px-3 py-2">{r.date}</td>
                <td className="px-3 py-2">
                  <DocCell
                    documentType={r.documentType}
                    documentNo={r.documentNo}
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
                  <Chip tone={OUTPUT_BUCKET_TONE[r.bucket]}>{OUTPUT_BUCKET_LABEL[r.bucket]}</Chip>
                  {r.taxCode && (
                    <div className="mt-0.5 font-mono text-[11px] text-gray-500">{r.taxCode}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.vatableSales} zeroAsDash />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.zeroRatedSales} zeroAsDash />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.exemptSales} zeroAsDash />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.otherSales} zeroAsDash />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.outputVat} bold />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.gross} zeroAsDash />
                </td>
                <td className="px-3 py-2">
                  <FlagChips flags={r.flags} />
                </td>
                <td className="px-3 py-2">
                  <SettledCell settledIn={r.settledIn} />
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
              data-testid="output-total"
              className="border-t-2 border-gray-200 bg-gray-50 font-semibold"
            >
              <td className="px-3 py-2" colSpan={6}>
                Total · {data.totals.rows} rows
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={data.totals.vatableSales} bold />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={data.totals.zeroRatedSales} zeroAsDash bold />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={data.totals.exemptSales} zeroAsDash bold />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={data.totals.otherSales} zeroAsDash bold />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={data.totals.outputVat} bold />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={data.totals.gross} bold />
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        )}
      </TableShell>
    </div>
  )
}
