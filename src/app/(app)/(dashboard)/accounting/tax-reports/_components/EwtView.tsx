'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { TaxReports, type TaxReportMeta, type TaxReportQuery } from '@/src/libs/data/TaxReportsData'
import { manilaToday } from '@/src/libs/tax/tax-reports'
import {
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
import { Chip } from './ui'

// EWT Payable Schedule — what NIG withheld from suppliers, by supplier and ATC:
// the figures a remittance is made from and a BIR 2307 certificate is issued
// from. The income payment is worked back from the tax and its rate, so it
// agrees with what was withheld even where someone typed the amount. An ATC the
// accountant has not supplied yet is flagged, never invented.
export default function EwtView({
  query,
  onMeta,
  canClose,
}: {
  query: TaxReportQuery
  onMeta: (m: TaxReportMeta | null) => void
  canClose: boolean
}) {
  const { data, loading, error } = useTaxReport(TaxReports.ewtSchedule, query)
  useEffect(() => onMeta(data?.meta ?? null), [data, onMeta])
  const through = query.endDate < manilaToday() ? query.endDate : manilaToday()

  return (
    <div>
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {data && data.totals.missingAtcRows > 0 && (
        <div
          data-testid="ewt-atc-note"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"
        >
          {data.totals.missingAtcRows} withholding{' '}
          {data.totals.missingAtcRows === 1 ? 'entry has' : 'entries have'} no ATC (
          <Money value={data.totals.missingAtcAmount} />
          ). The ATC list has to come from NIG&rsquo;s accountant; this schedule is not ready for
          BIR filing until it is in.
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          testId="stat-withheld"
          label="Tax withheld in the period"
          value={<Money value={data?.totals.withheld} />}
        />
        <StatCard
          testId="stat-remitted"
          label="Remitted in the period"
          value={<Money value={data?.totals.remitted} />}
          hint={
            data && data.totals.remitted === null
              ? 'A remittance pays all the withholding accounts together: clear the filters to see it.'
              : undefined
          }
          tone="gray"
        />
        <StatCard
          testId="stat-outstanding"
          label="Withheld less remitted"
          value={<Money value={data?.totals.outstanding} />}
          hint={
            canClose ? (
              <Link
                href={`/accounting/tax-closing/wht/new?asOf=${through}`}
                className="font-medium text-purple-700 hover:underline"
              >
                Remit withholding tax →
              </Link>
            ) : undefined
          }
          tone="amber"
        />
      </div>

      <h2 className="mb-2 text-sm font-semibold text-prominent-purple-900">By supplier and ATC</h2>
      <div className="mb-6">
        <TableShell testId="ewt-summary-table">
          <thead className={HEAD}>
            <tr>
              <th className={TH}>Supplier</th>
              <th className={TH}>TIN</th>
              <th className={TH}>ATC</th>
              <th className={TH}>Tax code</th>
              <th className={THR}>Entries</th>
              <th className={THR}>Income payment</th>
              <th className={THR}>Tax withheld</th>
            </tr>
          </thead>
          <tbody>
            {!data || data.summary.length === 0 ? (
              <EmptyRow cols={7} loading={loading} text="No withholding in this period." />
            ) : (
              data.summary.map((s, i) => (
                <tr
                  key={`${s.supplierId ?? s.supplierName}-${s.atc}-${s.taxCode}-${i}`}
                  data-testid="ewt-summary-row"
                  className="border-t border-gray-100"
                >
                  <td className="px-3 py-2">{s.supplierName}</td>
                  <td className="px-3 py-2">{s.tin ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {s.atc ?? <Chip tone="amber">No ATC</Chip>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {s.taxCode ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.rows}</td>
                  <td className="px-3 py-2 text-right">
                    <Money value={s.baseAmount} zeroAsDash />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={s.withheld} bold />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-prominent-purple-900">Entries</h2>
      <TableShell testId="ewt-table">
        <thead className={HEAD}>
          <tr>
            <th className={TH}>Date</th>
            <th className={TH}>Document</th>
            <th className={TH}>Supplier invoice</th>
            <th className={TH}>Supplier</th>
            <th className={TH}>Branch</th>
            <th className={TH}>Code</th>
            <th className={TH}>ATC</th>
            <th className={THR}>Rate</th>
            <th className={THR}>Income payment</th>
            <th className={THR}>Tax withheld</th>
            <th className={TH}>Account</th>
            <th className={TH}>Notes</th>
            <th className={TH}>Remitted</th>
            <th className={TH}>Entry</th>
          </tr>
        </thead>
        <tbody>
          {!data || data.rows.length === 0 ? (
            <EmptyRow cols={14} loading={loading} text="No withholding in this period." />
          ) : (
            data.rows.map((r, i) => (
              <tr
                key={`${r.journalEntryId}-${i}`}
                data-testid="ewt-row"
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
                  {r.supplierName}
                  {r.tin && <div className="text-[11px] text-gray-500">TIN {r.tin}</div>}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{r.branchName}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.taxCode ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {r.atc ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.ratePercent != null ? `${r.ratePercent}%` : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.baseAmount} zeroAsDash />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.withheld} bold />
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.accountNumber}</td>
                <td className="px-3 py-2">
                  <FlagChips flags={r.flags} />
                </td>
                <td className="px-3 py-2">
                  {r.settledIn ? (
                    <Chip tone="green">{r.settledIn}</Chip>
                  ) : (
                    <span className="text-[12px] text-gray-400">Open</span>
                  )}
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
              data-testid="ewt-total"
              className="border-t-2 border-gray-200 bg-gray-50 font-semibold"
            >
              <td className="px-3 py-2" colSpan={9}>
                Total · {data.totals.rows} rows
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={data.totals.withheld} bold />
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        )}
      </TableShell>
    </div>
  )
}
