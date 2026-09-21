'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Plus, RefreshCw } from 'lucide-react'
import {
  AcknowledgementReceipts,
  fmtMoney,
  fmtDate,
  type AcknowledgementReceipt,
} from '@/src/libs/data/AccountingV2Data'

function accountLabel(account: AcknowledgementReceipt['account']): string {
  if (!account) return '—'
  return account.number ? `${account.number} — ${account.name}` : account.name
}

/** Scenario 57 — the plain chronological register for Acknowledgement
 * Receipts, reached from POS Collections' own "Acknowledgement Receipts"
 * link (developer correction, 2026-09-21 — moved off Accounting's AR
 * Invoices page onto POS Collections, matching the client's own notes). No
 * search/filter yet, matching Collection Receipt's own initial scope. */
export default function AcknowledgementReceiptsList() {
  const router = useRouter()
  const [receipts, setReceipts] = useState<AcknowledgementReceipt[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    AcknowledgementReceipts.list().then((res) => {
      setReceipts(res.data ?? [])
      setLoading(false)
    })
  }
  useEffect(load, [])

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <Link
        href="/pos/collections"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Collections
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-prominent-purple-900">Acknowledgement Receipts</h2>
          <p className="text-sm text-gray-500">
            Money received with no customer or invoice behind it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={() => router.push('/pos/collections/acknowledgement/new')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800"
          >
            <Plus className="w-4 h-4" /> New Acknowledgement Receipt
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2.5">Receipt No.</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Received From</th>
              <th className="px-4 py-2.5">Account</th>
              <th className="px-4 py-2.5">Description</th>
              <th className="px-4 py-2.5">Branch</th>
              <th className="px-4 py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : receipts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No acknowledgement receipts yet.
                </td>
              </tr>
            ) : (
              receipts.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/pos/collections/acknowledgement/view?id=${r.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-2.5 font-medium text-gray-900">{r.number ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{fmtDate(r.paymentDate)}</td>
                  <td className="px-4 py-2.5 text-gray-900">{r.payerName}</td>
                  <td className="px-4 py-2.5 text-gray-600">{accountLabel(r.account)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.reason ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{r.branch?.name ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums text-gray-900">
                    {fmtMoney(r.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
