'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { agentsApi } from '@/src/libs/api/crm'
import type { Agent, AgentInvoice, AgentSaleType } from '@/src/schema/crm/types'
import { getBranches } from '../../_actions/get-branches'

function fmtMoney(n: number): string {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const SALE_TYPE_LABEL: Record<AgentSaleType, string> = {
  installment: 'Installment',
  tpf: 'TPF',
  cash: 'Cash',
  charge: 'Charge',
  mixed: 'Mixed',
}

// Scenario 78 — every invoice the agent sold, with its commission and the
// Commissions - Sales voucher that released it. Replaces the Scenario-01
// commission-only dialog: that one was driven by AgentCommission, so an agent
// with no rate set (the whole imported roster) showed nothing, and it named
// the POS number rather than the SI. A page rather than a dialog so the list
// has room to grow and can be linked to.
export default function AgentInvoices({ id }: { id: string }) {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [branchName, setBranchName] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<AgentInvoice[] | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [agentRes, invoicesRes, branchesRes] = await Promise.all([
        agentsApi.get(id),
        agentsApi.invoices(id),
        getBranches(),
      ])
      if (cancelled) return
      if (!agentRes.success || !agentRes.data) {
        setNotFound(true)
        return
      }
      setAgent(agentRes.data)
      const branchId = agentRes.data.branchId
      if (branchId && branchesRes.success && branchesRes.data) {
        setBranchName(branchesRes.data.data.find((b) => b.id === branchId)?.name ?? null)
      }
      if (invoicesRes.success && invoicesRes.data) {
        setInvoices(invoicesRes.data)
      } else {
        toast.error(invoicesRes.message || invoicesRes.error || 'Could not load invoices')
        setInvoices([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const rows = invoices ?? []
  const totalCommission = rows.reduce((sum, r) => sum + (r.commission ?? 0), 0)
  // A draft voucher already holds the sale but hasn't paid anything out yet.
  const totalReleased = rows.reduce(
    (sum, r) => sum + (r.released && !r.released.isDraft ? r.released.amount : 0),
    0
  )

  return (
    <div className="w-full h-full p-4 md:p-6 lg:p-8">
      <Link
        href="/crm/agents"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sales agents
      </Link>

      {notFound ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          Sales agent not found.
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              {agent?.name ?? 'Loading...'}
            </h2>
            {agent && (
              <p className="mt-1 text-sm text-gray-500">
                {branchName ?? 'All branches'} ·{' '}
                {agent.commissionRate != null
                  ? `${(agent.commissionRate * 100).toFixed(2)}% rate`
                  : 'No commission rate configured'}{' '}
                · <span className="capitalize">{agent.status}</span>
              </p>
            )}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Invoices" value={invoices === null ? '-' : String(rows.length)} />
            <Stat label="Commission" value={invoices === null ? '-' : fmtMoney(totalCommission)} />
            <Stat label="Released" value={invoices === null ? '-' : fmtMoney(totalReleased)} />
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-zinc-200 overflow-hidden">
            <div className="overflow-x-auto">
              {invoices === null ? (
                <div className="p-8 text-center text-sm text-zinc-400">Loading...</div>
              ) : rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-400">No invoices sold yet.</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        Date
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        SI No.
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        Customer
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        Type
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        Amount
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        Commission
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-600 uppercase">
                        Released
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 text-sm text-zinc-500 whitespace-nowrap">
                          {fmtDate(r.date)}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className="font-medium text-zinc-800">
                            {r.salesInvoiceNumber ?? '-'}
                          </span>
                          <span className="block text-xs text-zinc-400">{r.transactionNumber}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">{r.customerName ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {SALE_TYPE_LABEL[r.type]}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-zinc-700 whitespace-nowrap">
                          {fmtMoney(r.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-700 whitespace-nowrap">
                          {r.commission != null ? fmtMoney(r.commission) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {r.released ? (
                            <>
                              <Link
                                href={`/accounting/expenses/${r.released.expenseId}`}
                                className="font-medium text-purple-700 hover:underline"
                              >
                                {r.released.voucherNumber}
                              </Link>
                              {r.released.isDraft && (
                                <span className="ml-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                  Draft
                                </span>
                              )}
                              <span className="block text-xs text-zinc-500">
                                {fmtMoney(r.released.amount)} · {fmtDate(r.released.date)}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-zinc-400">Not released</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
