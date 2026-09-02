'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Search } from 'lucide-react'
import {
  APBills,
  fmtMoney,
  fmtDate,
  type APPaymentListItem,
} from '@/src/libs/data/AccountingV2Data'

// Scenario 43 Part D — the standalone Payments list the client's own
// legacy tool has and this app never did (a payment was only ever visible
// nested inside its one bill's detail page). Read-only, same columns as
// the reference (Date/Reference/Paid from/Description/Payee/Accounts/
// Amount/Voucher #), each row linking back to its parent bill — no
// separate create/edit surface here, Record Payment on a bill remains the
// only way a payment is made.
export default function APPaymentsList() {
  const router = useRouter()
  const [items, setItems] = useState<APPaymentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async (searchValue?: string) => {
    setLoading(true)
    const res = await APBills.listPayments(searchValue ? { search: searchValue } : undefined)
    setItems(res.data?.items ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(search || undefined)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link
        href="/accounting/ap-bills"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="w-4 h-4" /> Back to AP Invoices
      </Link>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Payments</h2>
          <p className="text-sm text-gray-500">Every AP payment recorded, across all bills.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => load(search || undefined)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <form onSubmit={onSearch} className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, cheque #, invoice #"
              className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg w-72"
            />
          </form>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-left">Paid from</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Payee</th>
              <th className="px-3 py-2 text-left">Accounts</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Voucher #</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                  No payments recorded yet.
                </td>
              </tr>
            ) : (
              items.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/accounting/ap-bills/${p.billId}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(p.paymentDate)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.reference ?? '—'}</td>
                  <td className="px-3 py-2">{p.bankAccount?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-600">{p.description || '—'}</td>
                  <td className="px-3 py-2">{p.payee ?? '—'}</td>
                  <td className="px-3 py-2">{p.effectiveExpenseAccount?.name ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">
                    {fmtMoney(p.amount)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{p.voucherNumber ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
