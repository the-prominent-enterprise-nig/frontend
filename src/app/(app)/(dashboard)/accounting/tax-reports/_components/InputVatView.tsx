'use client'

import { useEffect } from 'react'
import { TaxReports, type TaxReportMeta, type TaxReportQuery } from '@/src/libs/data/TaxReportsData'
import { INPUT_BUCKET_LABEL, INPUT_BUCKET_TONE } from '@/src/libs/tax/tax-reports'
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

// Input VAT Detail — each purchase line that carries VAT, with its code and
// class, the base it was charged on and, for a capital purchase, the project or
// asset it is for. What is claimable is said, not left to be worked out.
export default function InputVatView({
  query,
  onMeta,
}: {
  query: TaxReportQuery
  onMeta: (m: TaxReportMeta | null) => void
}) {
  const { data, loading, error } = useTaxReport(TaxReports.inputVat, query)
  useEffect(() => onMeta(data?.meta ?? null), [data, onMeta])

  return (
    <div>
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div data-testid="input-summary" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(data?.summary ?? []).map((s) => (
          <StatCard
            key={s.bucket}
            testId={`class-${s.bucket}`}
            label={`${INPUT_BUCKET_LABEL[s.bucket]} · ${s.rows}`}
            value={<Money value={s.inputVat} />}
            hint={
              <span>
                Base <Money value={s.base} />
              </span>
            }
            tone={s.bucket === 'UNCODED' ? 'red' : 'purple'}
          />
        ))}
        {data && data.summary.length === 0 && (
          <div className="text-sm text-gray-500">No purchase carries VAT in this period.</div>
        )}
      </div>

      <TableShell testId="input-vat-table">
        <thead className={HEAD}>
          <tr>
            <th className={TH}>Date</th>
            <th className={TH}>Document</th>
            <th className={TH}>Supplier invoice</th>
            <th className={TH}>Supplier</th>
            <th className={TH}>Branch</th>
            <th className={TH}>Line</th>
            <th className={TH}>Code</th>
            <th className={TH}>Project / asset</th>
            <th className={THR}>Base</th>
            <th className={THR}>Input VAT</th>
            <th className={TH}>Claimable</th>
            <th className={TH}>Notes</th>
            <th className={TH}>Settled</th>
            <th className={TH}>Entry</th>
          </tr>
        </thead>
        <tbody>
          {!data || data.rows.length === 0 ? (
            <EmptyRow
              cols={14}
              loading={loading}
              text="No purchase lines carry VAT in this period."
            />
          ) : (
            data.rows.map((r, i) => (
              <tr
                key={`${r.journalEntryId}-${r.lineNumber}-${i}`}
                data-testid="input-row"
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
                <td className="px-3 py-2">
                  {r.lineNumber ?? <span className="text-gray-300">—</span>}
                  {r.description && (
                    <div className="max-w-[220px] text-[11px] text-gray-500">{r.description}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Chip tone={INPUT_BUCKET_TONE[r.bucket]}>{INPUT_BUCKET_LABEL[r.bucket]}</Chip>
                  {r.taxCode && (
                    <div className="mt-0.5 font-mono text-[11px] text-gray-500">{r.taxCode}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.projectAssetRef ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.base} zeroAsDash />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={r.inputVat} bold />
                </td>
                <td className="px-3 py-2">
                  {r.claimable ? (
                    <Chip tone="green">Yes</Chip>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
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
              data-testid="input-total"
              className="border-t-2 border-gray-200 bg-gray-50 font-semibold"
            >
              <td className="px-3 py-2" colSpan={8}>
                Total · {data.totals.rows} rows (claimable{' '}
                <Money value={data.totals.claimable} bold />)
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={data.totals.base} bold />
              </td>
              <td className="px-3 py-2 text-right">
                <Money value={data.totals.inputVat} bold />
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        )}
      </TableShell>
    </div>
  )
}
