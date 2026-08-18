'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Search, ChevronDown, ChevronRight, Ban } from 'lucide-react'
import {
  DebitMemos,
  type DebitMemo,
  type DebitMemoType,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'
import Tooltip from '@/src/components/ui/Tooltip'

const TYPE_LABELS: Record<DebitMemoType, string> = {
  unit_replacement: 'Unit Replacement',
  billing_adjustment: 'Billing Adjustment',
}

const STATUS_BADGE: Record<string, string> = {
  ISSUED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  VOID: 'bg-gray-100 text-gray-500 ring-gray-200',
}

export default function DebitMemosList() {
  const [items, setItems] = useState<DebitMemo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [voiding, setVoiding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await DebitMemos.list(search ? { search } : undefined)
    setItems(res.data?.items ?? [])
    setLoading(false)
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  const voidMemo = async (id: string) => {
    if (
      !confirm(
        'Void this debit memo? This reverses its journal entry and restores the invoice balance.'
      )
    ) {
      return
    }
    setVoiding(id)
    setError(null)
    const res = await DebitMemos.void(id)
    setVoiding(null)
    if (!res.success) {
      setError(res.message || res.error || 'Failed to void debit memo')
      return
    }
    load()
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Debit Memos</h2>
          <p className="text-sm text-gray-500">
            Every debit memo issued against an AR invoice — a pricier replacement unit or an
            under-billed fee.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search memo # or reason…"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left"></th>
              <th className="px-3 py-2 text-left">Memo #</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Invoice</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  No debit memos found.
                </td>
              </tr>
            ) : (
              items.map((m) => (
                <Fragment key={m.id}>
                  <tr
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                  >
                    <td className="px-3 py-2 text-gray-400">
                      {expanded === m.id ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono">{m.memoNumber}</td>
                    <td className="px-3 py-2">{TYPE_LABELS[m.type] ?? m.type}</td>
                    <td className="px-3 py-2">
                      {m.arInvoice ? (
                        <Link
                          href={`/accounting/ar-invoices/${m.arInvoice.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-purple-700 hover:underline"
                        >
                          {m.arInvoice.invoiceNumber}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">{m.customer?.name ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtMoney(m.amount)}</td>
                    <td className="px-3 py-2 text-gray-500">{fmtDate(m.memoDate)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_BADGE[m.status] ?? 'bg-gray-100 text-gray-500 ring-gray-200'}`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.status === 'ISSUED' && (
                        <Tooltip label="Void debit memo">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              voidMemo(m.id)
                            }}
                            disabled={voiding === m.id}
                            aria-label="Void debit memo"
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                  {expanded === m.id && (
                    <tr key={`${m.id}-detail`} className="bg-gray-50">
                      <td colSpan={9} className="px-3 py-3">
                        {m.reason && (
                          <div className="mb-2 text-xs text-gray-600">
                            <span className="font-medium">Reason: </span>
                            {m.reason}
                          </div>
                        )}
                        {m.lines.length === 0 ? (
                          <p className="text-xs text-gray-400">No line items.</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="text-gray-500">
                              <tr>
                                <th className="px-2 py-1 text-left">Item</th>
                                <th className="px-2 py-1 text-left">Serial</th>
                                <th className="px-2 py-1 text-right">Qty</th>
                                <th className="px-2 py-1 text-right">Unit Price</th>
                                <th className="px-2 py-1 text-right">Addition</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {m.lines.map((l) => (
                                <tr key={l.id}>
                                  <td className="px-2 py-1">{l.itemName ?? l.itemId}</td>
                                  <td className="px-2 py-1">
                                    {l.serialNumber?.serialNumber ?? '—'}
                                  </td>
                                  <td className="px-2 py-1 text-right">{l.quantity}</td>
                                  <td className="px-2 py-1 text-right">{fmtMoney(l.unitPrice)}</td>
                                  <td className="px-2 py-1 text-right">
                                    {fmtMoney(l.additionAmount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
