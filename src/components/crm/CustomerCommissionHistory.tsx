'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Coins } from 'lucide-react'
import { customersApi } from '@/src/libs/api/crm'
import { fmtDate, fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { saleDocNo } from '@/src/libs/format/saleDocNo'
import { LedgerCard } from '@/src/components/crm/LedgerParts'
import type { AgentInvoice, AgentInvoiceRelease } from '@/src/schema/crm/types'

/**
 * Scenario 78 Part 3 — the client's "CRM ledger - Commissions history", on the
 * customer's ledger: each of the customer's sales an agent was credited with,
 * the agent, the commission recorded in Expenses and the Commissions - Sales
 * voucher that released it. The same rows as the agent's own page, seen from
 * the customer's side.
 *
 * Quiet when there's nothing to show: no agent-credited sales, or a caller who
 * can't read it (the ledger is also opened from POS) — the ledger above is
 * the point of the page, so this never errors at it.
 */
export default function CustomerCommissionHistory({
  customerId,
  transactionId,
  linkAgents = true,
}: {
  customerId: string
  /** The ledger's purchase key when it is narrowed to one purchase — the
   * history then shows that sale's commission only. */
  transactionId?: string
  /** False under POS — a cashier can't open the CRM agent page. */
  linkAgents?: boolean
}) {
  const [rows, setRows] = useState<AgentInvoice[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await customersApi.commissions(customerId, transactionId)
      if (!cancelled) setRows(res.success && res.data ? res.data : [])
    })()
    return () => {
      cancelled = true
    }
  }, [customerId, transactionId])

  if (!rows || rows.length === 0) return null

  const totalCommission = rows.reduce((sum, r) => sum + (r.commission ?? 0), 0)

  return (
    <LedgerCard title="Commissions History" icon={Coins} className="mt-4">
      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-gray-50 text-left text-[12px] font-semibold uppercase tracking-wide text-gray-600">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">SI / DR No.</th>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Commission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-1.5 text-gray-700">{fmtDate(r.date)}</td>
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[13px] text-gray-700">
                  {saleDocNo(r)}
                </td>
                <td className="px-3 py-1.5 text-gray-800">
                  {linkAgents && r.agentId ? (
                    <Link
                      href={`/crm/agents/${r.agentId}`}
                      className="font-medium text-prominent-purple-700 hover:underline"
                    >
                      {r.agentName}
                    </Link>
                  ) : (
                    (r.agentName ?? '—')
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-800">
                  {fmtMoney(r.totalAmount)}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right">
                  <CommissionCell commission={r.commission} release={r.released} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-prominent-purple-100 bg-prominent-purple-50 font-semibold text-prominent-purple-900">
              <td className="px-3 py-2" colSpan={4}>
                Total commission
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(totalCommission)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </LedgerCard>
  )
}

/** The commission with the voucher that released it under it, a Draft badge
 * while the entry is still a draft (a draft carries no commission yet). */
function CommissionCell({
  commission,
  release,
}: {
  commission: number | null
  release: AgentInvoiceRelease | null
}) {
  if (!release) return <span className="text-[13px] text-gray-500">Commission not released</span>
  return (
    <>
      <span className="block font-semibold tabular-nums text-emerald-700">
        {commission != null ? fmtMoney(commission) : '—'}
      </span>
      <span className="block text-[13px] text-gray-600">
        <Link
          href={`/accounting/expenses/${release.expenseId}`}
          className="font-medium text-prominent-purple-700 hover:underline"
        >
          {release.voucherNumber}
        </Link>
        {release.isDraft && (
          <span className="ml-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            Draft
          </span>
        )}{' '}
        · {fmtDate(release.date)}
      </span>
    </>
  )
}
