'use client'

import { useEffect } from 'react'
import {
  TaxReports,
  type ReconciliationChecks,
  type TaxReportMeta,
  type TaxReportQuery,
} from '@/src/libs/data/TaxReportsData'
import { Chip, EmptyRow, HEAD, Money, TH, THR, TableShell, useTaxReport } from './ui'

// VAT / WHT GL Reconciliation — the tax accounts of the General Ledger set
// against the documents behind them: how much of each account's movement is a
// sale or purchase, how much a closing entry, and how much is an entry no
// document explains. "Document differs" is where a document's own tax figure
// does not match what was posted for it. Below it, what a closer should look at.

const CHECKS: {
  key: keyof ReconciliationChecks
  label: string
  help: string
  /** Not a problem to be zero: a check for a thing the books cannot do. */
  money?: boolean
}[] = [
  {
    key: 'unclassifiedSales',
    label: 'Sales with no VAT class',
    help: 'An invoice that charged no VAT and was never classified: zero-rated, exempt or out of scope. A guess either way would be a wrong return, so it is left for someone to classify.',
  },
  {
    key: 'uncodedPurchases',
    label: 'Purchase lines with VAT and no tax code',
    help: 'Read as a plain VATable purchase (VAT-IN-12). Code them so the return reads each as it was.',
  },
  {
    key: 'withholdingNoAtc',
    label: 'Withholding with no ATC',
    help: 'The ATC list has to come from NIG’s accountant. Until it is in, the EWT schedule is not ready for BIR filing.',
  },
  {
    key: 'withholdingNoCode',
    label: 'Withholding with no tax code',
    help: 'Usually a receiving report: it keeps no code of its own, and the bill it scaffolds names it only when there is one.',
  },
  {
    key: 'certificatesPending',
    label: 'Creditable withholding with no 2307 yet',
    help: 'The customer withheld the tax but the certificate has not arrived. The credit is not claimable without it.',
  },
  {
    key: 'creditMemosAgainstVatableInvoices',
    label: 'Credit memos on VATable invoices',
    help: 'The books post a credit memo as Dr Sales / Cr Receivable with no VAT line, so the Output VAT those invoices carried is not reduced. The return may need an adjustment.',
    money: true,
  },
]

export default function ReconciliationView({
  query,
  onMeta,
}: {
  query: TaxReportQuery
  onMeta: (m: TaxReportMeta | null) => void
}) {
  const { data, loading, error } = useTaxReport(TaxReports.reconciliation, query)
  useEffect(() => onMeta(data?.meta ?? null), [data, onMeta])

  return (
    <div>
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <TableShell testId="recon-table">
        <thead className={HEAD}>
          <tr>
            <th className={TH}>Account</th>
            <th className={THR}>Opening</th>
            <th className={THR}>Debits</th>
            <th className={THR}>Credits</th>
            <th className={THR}>Movement</th>
            <th className={THR}>From documents</th>
            <th className={THR}>Closing entries</th>
            <th className={THR}>No source document</th>
            <th className={THR}>Unexplained</th>
            <th className={THR}>Document differs</th>
            <th className={THR}>Closing</th>
            <th className={TH}>Status</th>
          </tr>
        </thead>
        <tbody>
          {!data || data.accounts.length === 0 ? (
            <EmptyRow cols={12} loading={loading} text="No tax accounts are mapped yet." />
          ) : (
            data.accounts.map((a) => (
              <tr key={a.key} data-testid={`recon-${a.key}`} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <div className="font-mono text-xs font-semibold text-purple-700">
                    {a.accountNumber}
                  </div>
                  <div className="text-[12px] text-gray-600">{a.accountName}</div>
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={a.opening} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={a.debits} zeroAsDash />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={a.credits} zeroAsDash />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={a.movement} bold />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={a.documents} zeroAsDash />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={a.settlements} zeroAsDash />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={a.adjustments} zeroAsDash />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={a.unexplained} zeroAsDash />
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={a.variance} zeroAsDash />
                  {a.varianceCount > 0 && (
                    <div className="text-[11px] text-red-700">{a.varianceCount} documents</div>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Money value={a.closing} bold />
                </td>
                <td className="px-3 py-2">
                  {a.status === 'RECONCILED' ? (
                    <Chip tone="green">Reconciled</Chip>
                  ) : (
                    <Chip tone="amber">Review</Chip>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>
      <p className="mt-2 text-[12px] text-gray-500">
        Balances are on each account&rsquo;s own side (a liability reads as what is owed). A user
        tied to a branch sees that branch&rsquo;s movement and no balance: the balance is the
        company&rsquo;s.
      </p>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-prominent-purple-900">What to look at</h2>
      <div data-testid="recon-checks" className="space-y-2">
        {data &&
          CHECKS.map((c) => {
            const v = data.checks[c.key]
            const clean = v.count === 0
            return (
              <div
                key={c.key}
                data-testid={`check-${c.key}`}
                className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="mt-0.5 max-w-3xl text-[12px] text-gray-500">{c.help}</div>
                </div>
                <div className="shrink-0 text-right">
                  {clean ? (
                    <Chip tone="green">None</Chip>
                  ) : (
                    <>
                      <Chip tone="amber">{v.count} to review</Chip>
                      <div className="mt-1 text-sm">
                        <Money value={v.amount} />
                      </div>
                      {c.money && 'impliedVat' in v && (
                        <div className="text-[11px] text-gray-500">
                          about <Money value={v.impliedVat} /> of Output VAT
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
