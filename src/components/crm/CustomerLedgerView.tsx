'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { customersApi } from '@/src/libs/api/crm'
import { fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { printUnifiedCustomerLedgerDocument } from '@/src/libs/print/printInventoryDocument'
import type { CustomerLedger } from '@/src/schema/crm/types'

// Unified per-customer ledger — merges installment, charge, and cash sale
// events into one chronological Date/Ref/Inst./Description/Debit/Credit/
// Due/Outstanding table (same row shape as InstallmentLedgerView.tsx's
// per-account ledger). Unlike that view, there's no single sale/item/agent/
// financing-scheme to show — this can span several separate purchases of
// different kinds — so the header here is just customer info + totals
// summarizing across every source, not the paper-form field grid.
export default function CustomerLedgerView({
  customerId,
  backHref,
  backLabel,
}: {
  customerId: string
  backHref: string
  backLabel: string
}) {
  const [ledger, setLedger] = useState<CustomerLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    customersApi.getLedger(customerId).then((res) => {
      if (res.success && res.data) {
        setLedger(res.data)
      } else {
        setError(res.message || res.error || 'Ledger not found')
      }
      setLoading(false)
    })
  }, [customerId])

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
                <h1 className="text-xl font-bold text-gray-900">Customer Ledger</h1>
                <p className="mt-1 text-sm text-gray-600">{ledger.customer.name}</p>
                <p className="font-mono text-xs text-gray-500">{ledger.customer.customerCode}</p>
              </div>
              <button
                type="button"
                onClick={() => printUnifiedCustomerLedgerDocument(ledger)}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
            </div>

            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <h2 className="p-4 pb-2 text-[14px] font-semibold text-gray-900">Totals</h2>
              <div className="grid grid-cols-2 gap-3 border-t border-gray-100 p-4 pt-3 sm:grid-cols-4">
                <TotalStat label="Total Billed" value={fmtMoney(ledger.totals.totalBilled)} />
                <TotalStat label="Total Paid" value={fmtMoney(ledger.totals.totalPaid)} />
                <TotalStat label="Total Rebates" value={fmtMoney(ledger.totals.totalRebates)} />
                <TotalStat label="Outstanding" value={fmtMoney(ledger.totals.outstanding)} bold />
              </div>
            </section>

            {ledger.items.length > 0 && (
              <section className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                <h2 className="p-4 pb-2 text-[14px] font-semibold text-gray-900">
                  Items Purchased
                </h2>
                <table className="w-full border-collapse border-t border-gray-100 text-[13px]">
                  <tbody className="divide-y divide-gray-100">
                    {ledger.items.map((item, i) => (
                      <tr key={i}>
                        <td className="w-32 px-4 py-2 text-gray-500">{fmtDate(item.date)}</td>
                        <td className="w-48 px-4 py-2 font-mono text-xs text-gray-500">
                          {item.ref}
                        </td>
                        <td className="px-4 py-2 font-medium text-gray-800">{item.itemLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

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

function TotalStat({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`mt-0.5 ${bold ? 'text-lg font-bold text-gray-900' : 'font-medium text-gray-800'}`}
      >
        {value}
      </p>
    </div>
  )
}
