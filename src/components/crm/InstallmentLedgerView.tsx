'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Printer } from 'lucide-react'
import { installmentAccountsApi } from '@/src/libs/api/crm'
import { fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { printCustomerLedgerDocument } from '@/src/libs/print/printInventoryDocument'
import type { InstallmentLedger } from '@/src/schema/crm/types'

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  closed: 'Closed',
  early_closed: 'Paid Off Early',
  written_off: 'Written Off',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700',
  closed: 'bg-green-100 text-green-700',
  early_closed: 'bg-green-100 text-green-700',
  written_off: 'bg-red-100 text-red-700',
}

// Shared by Accounting's customer view (/accounting/customers/[id]/installments/[accountId])
// and CRM's (/crm/customers/[id]/installments/[accountId]) — same ledger data
// either way, just a different back link and "full account details" is
// always CRM's own installment-account page regardless of entry point.
//
// Field groups mirror the client's paper "Customer Ledger" form (sale info,
// item, assignment, financing terms, totals, then the Date/Ref/Inst./
// Description/Debit/Credit/Due/Outstanding table) — see
// InstallmentAccountService.getLedger()'s doc comment for exactly which
// paper-form fields/rows this can and can't reproduce from real data (no
// Unit Manager anywhere in this system, no itemized Total Penalty separate
// from Penalty Balance, no memo-only voucher rows). Section/Row styling
// matches this same folder's InstallmentAccountDetail.tsx (the CRM account
// page this links out to) rather than a boxed form-grid look.
export default function InstallmentLedgerView({
  accountId,
  backHref,
  backLabel,
}: {
  accountId: string
  backHref: string
  backLabel: string
}) {
  const [ledger, setLedger] = useState<InstallmentLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    installmentAccountsApi.getLedger(accountId).then((res) => {
      if (res.success && res.data) {
        setLedger(res.data)
      } else {
        setError(res.message || res.error || 'Ledger not found')
      }
      setLoading(false)
    })
  }, [accountId])

  return (
    <div className="w-full h-full p-4 md:p-6 lg:p-8">
      <div>
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        {loading ? (
          <div className="mt-6 text-center text-gray-500">Loading…</div>
        ) : error || !ledger ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error ?? 'Ledger not found'}
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">Customer Ledger</h1>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLES[ledger.account.status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {STATUS_LABELS[ledger.account.status] ?? ledger.account.status}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-gray-500">
                  {ledger.account.accountNumber}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printCustomerLedgerDocument(ledger)}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <Link
                  href={`/crm/installment-accounts/${accountId}`}
                  className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50"
                >
                  Full account details <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <h2 className="p-4 pb-2 text-[14px] font-semibold text-gray-900">Sale</h2>
              <InfoTable
                fields={[
                  {
                    label: 'Lastname',
                    value: ledger.account.customer.lastName ?? ledger.account.customer.name,
                  },
                  { label: 'Firstname', value: ledger.account.customer.firstName ?? '—' },
                  { label: 'Middle', value: ledger.account.customer.middleName ?? '—' },
                  { label: 'Sales Invoice No.', value: ledger.saleReference ?? '—' },
                  { label: 'SI Date', value: ledger.saleDate ? fmtDate(ledger.saleDate) : '—' },
                ]}
              />
            </section>

            {ledger.account.unitItems.length > 0 && (
              <section className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <h2 className="p-4 pb-2 text-[14px] font-semibold text-gray-900">Item</h2>
                <InfoTable
                  fields={[
                    { label: 'Brand', value: ledger.account.unitItems[0].brand ?? '—' },
                    { label: 'Type', value: ledger.account.unitItems[0].itemType ?? '—' },
                    { label: 'Model', value: ledger.account.unitItems[0].modelNumber ?? '—' },
                    {
                      label: 'Serial',
                      value:
                        ledger.account.unitItems[0].serialNumber ??
                        (ledger.account.unitItems.length > 1
                          ? `+${ledger.account.unitItems.length - 1} more item(s)`
                          : '—'),
                    },
                  ]}
                />
              </section>
            )}

            <section className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <h2 className="p-4 pb-2 text-[14px] font-semibold text-gray-900">Assignment</h2>
              <InfoTable
                fields={[
                  { label: 'Agent', value: ledger.account.sellingAgent?.name ?? '—' },
                  // No "Unit Manager" role/relation exists anywhere in this
                  // system — left blank rather than guessed.
                  { label: 'Unit Manager', value: '—' },
                  {
                    label: 'Collector',
                    value: ledger.account.collector
                      ? `${ledger.account.collector.stubNumber} — ${ledger.account.collector.name}`
                      : 'Unassigned',
                  },
                  {
                    label: 'FMI',
                    value: ledger.firstInstallmentDate ? fmtDate(ledger.firstInstallmentDate) : '—',
                  },
                ]}
              />
            </section>

            <section className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <h2 className="p-4 pb-2 text-[14px] font-semibold text-gray-900">Financing</h2>
              <InfoTable
                fields={[
                  { label: 'LCP', value: fmtMoney(ledger.account.listedCashPrice) },
                  { label: 'Down', value: fmtMoney(ledger.account.downPayment) },
                  { label: 'Amt. Financed', value: fmtMoney(ledger.account.amountFinanced) },
                  { label: 'Inst. Diff.', value: fmtMoney(ledger.account.interestDifferential) },
                  { label: 'Scheme', value: ledger.account.priceUseType?.name ?? '—' },
                  { label: 'MI', value: fmtMoney(ledger.account.monthlyInstallment) },
                  { label: 'Term', value: `${ledger.account.termMonths} months` },
                  { label: 'Branch', value: ledger.account.branch?.name ?? '—' },
                  { label: 'PN', value: fmtMoney(ledger.account.pnv) },
                  { label: 'IC', value: fmtMoney(ledger.account.insuranceCharge ?? 0) },
                  { label: 'Total Price', value: fmtMoney(ledger.account.totalPrice) },
                ]}
              />
            </section>

            <section className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <h2 className="p-4 pb-2 text-[14px] font-semibold text-gray-900">Totals</h2>
              <InfoTable
                fields={[
                  { label: 'Total Payments', value: fmtMoney(ledger.account.totalPayments) },
                  // Only one running "penalty" figure exists on this account
                  // (no itemized assessment history) — reused for both.
                  { label: 'Total Penalty', value: '—' },
                  { label: 'Penalty Balance', value: fmtMoney(ledger.account.penalty) },
                  { label: 'Total Rebates', value: fmtMoney(ledger.account.totalRebates) },
                  { label: 'Total Billing', value: fmtMoney(ledger.account.totalBilling) },
                  { label: 'Required DP', value: fmtMoney(ledger.account.downPayment) },
                  { label: 'DP Balance', value: fmtMoney(ledger.account.dpBalance) },
                  { label: 'Tot. Amt. Due', value: fmtMoney(ledger.account.totalDue) },
                  { label: 'Tot. Amt. Out', value: fmtMoney(ledger.account.currentBalance) },
                ]}
              />
            </section>

            <section className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <h2 className="border-b border-gray-100 p-4 pb-2 text-[14px] font-semibold text-gray-900">
                Ledger
              </h2>
              {ledger.rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">No ledger activity yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="border-r border-gray-100 px-4 py-1.5">Date</th>
                        <th className="border-r border-gray-100 px-4 py-1.5">Ref</th>
                        <th className="border-r border-gray-100 px-4 py-1.5 text-right">Inst.</th>
                        <th className="border-r border-gray-100 px-4 py-1.5">Description</th>
                        <th className="border-r border-gray-100 px-4 py-1.5 text-right">Debit</th>
                        <th className="border-r border-gray-100 px-4 py-1.5 text-right">Credit</th>
                        <th className="border-r border-gray-100 px-4 py-1.5 text-right">Due</th>
                        <th className="px-4 py-1.5 text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ledger.rows.map((row, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap border-r border-gray-100 px-4 py-1.5 text-gray-600">
                            {fmtDate(row.date)}
                          </td>
                          <td className="whitespace-nowrap border-r border-gray-100 px-4 py-1.5 font-mono text-xs text-gray-500">
                            {row.ref}
                          </td>
                          <td className="border-r border-gray-100 px-4 py-1.5 text-right text-gray-500">
                            {row.inst > 0 ? row.inst : '—'}
                          </td>
                          <td className="border-r border-gray-100 px-4 py-1.5 text-gray-800">
                            {row.description}
                          </td>
                          <td className="border-r border-gray-100 px-4 py-1.5 text-right text-gray-800">
                            {row.debit > 0 ? fmtMoney(row.debit) : '—'}
                          </td>
                          <td className="border-r border-gray-100 px-4 py-1.5 text-right text-gray-800">
                            {row.credit > 0 ? fmtMoney(row.credit) : '—'}
                          </td>
                          <td
                            className={`border-r border-gray-100 px-4 py-1.5 text-right ${row.due < 0 ? 'text-red-600' : 'text-gray-800'}`}
                          >
                            {fmtMoney(row.due)}
                          </td>
                          <td className="px-4 py-1.5 text-right font-semibold text-gray-900">
                            {fmtMoney(row.outstanding)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50 text-[13px] font-semibold text-gray-900">
                        <td className="border-r border-gray-100 px-4 py-1.5" colSpan={4}>
                          Total
                        </td>
                        <td className="border-r border-gray-100 px-4 py-1.5 text-right">
                          {fmtMoney(ledger.rows.reduce((sum, r) => sum + r.debit, 0))}
                        </td>
                        <td className="border-r border-gray-100 px-4 py-1.5 text-right">
                          {fmtMoney(ledger.rows.reduce((sum, r) => sum + r.credit, 0))}
                        </td>
                        <td className="border-r border-gray-100 px-4 py-1.5" />
                        <td className="px-4 py-1.5" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

// Renders a label/value field list as a real bordered table (3 fields per
// row) instead of a CSS grid — a wrapping grid can't keep its divider lines
// aligned into a continuous grid once a row doesn't fill every column, but
// a <table> row always does since each <tr> only ever holds that row's own
// cells, padded out with blank cells when a group's field count isn't a
// multiple of 3.
function InfoTable({ fields }: { fields: { label: string; value: React.ReactNode }[] }) {
  const columns = 3
  const rows: { label: string; value: React.ReactNode }[][] = []
  for (let i = 0; i < fields.length; i += columns) {
    rows.push(fields.slice(i, i + columns))
  }

  return (
    <table className="w-full border-collapse border-t border-gray-100 text-[13px]">
      <tbody className="divide-y divide-gray-100">
        {rows.map((row, ri) => (
          <tr key={ri}>
            {Array.from({ length: columns }).map((_, ci) => {
              const field = row[ci]
              return (
                <td key={ci} className="w-1/3 border-r border-gray-100 px-4 py-2 last:border-r-0">
                  {field && (
                    <>
                      <p className="text-gray-500">{field.label}</p>
                      <p className="mt-0.5 font-medium text-gray-800">{field.value}</p>
                    </>
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
