'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { customersApi } from '@/src/libs/api/crm'
import { fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { saleDocNo } from '@/src/libs/format/saleDocNo'
import type { AgentInvoice, AgentInvoiceRelease } from '@/src/schema/crm/types'

/**
 * Scenario 78 Part 3 — the client's "CRM ledger - Commissions history", on the
 * customer's ledger: each of the customer's sales an agent was credited with,
 * the agent, the commission accrued and the Commissions - Sales / SMI vouchers
 * that released it. The same rows as the agent's own page, seen from the
 * customer's side.
 *
 * Quiet when there's nothing to show: no agent-credited sales, or a caller who
 * can't read it (the ledger is also opened from POS) — the ledger above is
 * the point of the page, so this never errors at it.
 */
export default function CustomerCommissionHistory({
  customerId,
  linkAgents = true,
}: {
  customerId: string
  /** False under POS — a cashier can't open the CRM agent page. */
  linkAgents?: boolean
}) {
  const [rows, setRows] = useState<AgentInvoice[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await customersApi.commissions(customerId)
      if (!cancelled) setRows(res.success && res.data ? res.data : [])
    })()
    return () => {
      cancelled = true
    }
  }, [customerId])

  if (!rows || rows.length === 0) return null

  const totalCommission = rows.reduce((sum, r) => sum + (r.commission ?? 0), 0)

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <h2 className="border-b border-gray-100 p-4 pb-2 text-[14px] font-semibold text-gray-900">
        Commissions History
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="border-r border-gray-100 px-4 py-1.5">Date</th>
              <th className="border-r border-gray-100 px-4 py-1.5">SI / DR No.</th>
              <th className="border-r border-gray-100 px-4 py-1.5">Agent</th>
              <th className="border-r border-gray-100 px-4 py-1.5 text-right">Amount</th>
              <th className="border-r border-gray-100 px-4 py-1.5 text-right">Commission</th>
              <th className="border-r border-gray-100 px-4 py-1.5">Released</th>
              <th className="px-4 py-1.5">SMI Released</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap border-r border-gray-100 px-4 py-1.5 text-gray-600">
                  {fmtDate(r.date)}
                </td>
                <td className="whitespace-nowrap border-r border-gray-100 px-4 py-1.5 font-mono text-xs text-gray-700">
                  {saleDocNo(r)}
                </td>
                <td className="border-r border-gray-100 px-4 py-1.5 text-gray-800">
                  {linkAgents && r.agentId ? (
                    <Link
                      href={`/crm/agents/${r.agentId}`}
                      className="text-purple-700 hover:underline"
                    >
                      {r.agentName}
                    </Link>
                  ) : (
                    (r.agentName ?? '—')
                  )}
                </td>
                <td className="whitespace-nowrap border-r border-gray-100 px-4 py-1.5 text-right text-gray-800">
                  {fmtMoney(r.totalAmount)}
                </td>
                <td className="whitespace-nowrap border-r border-gray-100 px-4 py-1.5 text-right font-medium text-emerald-700">
                  {r.commission != null ? fmtMoney(r.commission) : '—'}
                </td>
                <td className="whitespace-nowrap border-r border-gray-100 px-4 py-1.5">
                  <Release release={r.released} empty="Commission not released" />
                </td>
                <td className="whitespace-nowrap px-4 py-1.5">
                  <Release release={r.smiReleased} empty="SMI not released" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 text-[13px] font-semibold text-gray-900">
              <td className="border-r border-gray-100 px-4 py-1.5" colSpan={4}>
                Total commission
              </td>
              <td className="border-r border-gray-100 px-4 py-1.5 text-right">
                {fmtMoney(totalCommission)}
              </td>
              <td className="border-r border-gray-100 px-4 py-1.5" />
              <td className="px-4 py-1.5" />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

function Release({ release, empty }: { release: AgentInvoiceRelease | null; empty: string }) {
  if (!release) return <span className="text-xs text-gray-400">{empty}</span>
  return (
    <>
      <Link
        href={`/accounting/expenses/${release.expenseId}`}
        className="font-medium text-purple-700 hover:underline"
      >
        {release.voucherNumber}
      </Link>
      {release.isDraft && (
        <span className="ml-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          Draft
        </span>
      )}
      <span className="block text-xs text-gray-500">
        {fmtMoney(release.amount)} · {fmtDate(release.date)}
      </span>
    </>
  )
}
