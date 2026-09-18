'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Search, Plus, Printer, ChevronRight } from 'lucide-react'
import { getApPaymentDocument } from '../../_actions/get-ap-payment-document'
import { getApDisbursementDocument } from '../../_actions/get-ap-disbursement-document'
import { printAPPaymentVoucherDocument } from '@/src/libs/print/printInventoryDocument'
import VoucherDocument, { type VoucherDocumentEnvelope } from '../../_components/VoucherDocument'
import {
  APBills,
  fmtMoney,
  fmtDate,
  type APDisbursementListItem,
} from '@/src/libs/data/AccountingV2Data'

// Scenario 43 Part D — the standalone Payments list the client's own legacy
// tool has and this app never did (a payment was only ever visible nested
// inside its one bill's detail page).
//
// One row per TRANSACTION, not per invoice. It was built per APPayment, so a
// cheque settling five invoices appeared as five rows, each carrying the same
// voucher number against a different partial amount and none showing the
// cheque total — the voucher had no row that actually was it. A row now
// expands to the invoices it settled.
export default function APPaymentsList() {
  const router = useRouter()
  const [items, setItems] = useState<APDisbursementListItem[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [printingFor, setPrintingFor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async (searchValue?: string) => {
    setLoading(true)
    const res = await APBills.listDisbursements(searchValue ? { search: searchValue } : undefined)
    // Paid only. This screen is the register of what left the bank, so a
    // voucher that has not been settled has no business in it — nothing left
    // the bank for one. Unpaid vouchers are reached from the invoices they
    // cover, via View voucher / Pay voucher.
    setItems((res.data?.items ?? []).filter((r) => r.status === 'PAID'))
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(search || undefined)
  }

  // A disbursement prints the whole transaction; a legacy per-bill payment has
  // only its own invoice to show, so it keeps the older document. Same print
  // shell either way, so a voucher looks identical wherever it is opened from.
  const printVoucher = async (row: APDisbursementListItem) => {
    setPrintingFor(row.id)
    try {
      const res =
        row.kind === 'disbursement'
          ? await getApDisbursementDocument(row.id)
          : await getApPaymentDocument(row.invoices[0]?.billId ?? '', row.id)
      if (res.success && res.data) printAPPaymentVoucherDocument(res.data)
      else alert(res.message || res.error || 'Could not build the voucher')
    } finally {
      setPrintingFor(null)
    }
  }

  // The voucher document behind an expanded row, fetched once and kept.
  // Reading what a cheque actually covered used to mean opening the print
  // window first; expanding the row now shows the voucher itself, and the
  // printer button just sends that same paper to a printer.
  const [voucherDocs, setVoucherDocs] = useState<Record<string, VoucherDocumentEnvelope>>({})

  const loadVoucher = async (row: APDisbursementListItem) => {
    if (voucherDocs[row.id]) return
    // Same two shapes printVoucher() picks between, for the same reason.
    const res =
      row.kind === 'disbursement'
        ? await getApDisbursementDocument(row.id)
        : await getApPaymentDocument(row.invoices[0]?.billId ?? '', row.id)
    if (res.success && res.data) {
      setVoucherDocs((prev) => ({ ...prev, [row.id]: res.data as VoucherDocumentEnvelope }))
    }
  }

  const toggle = (row: APDisbursementListItem) => {
    const willOpen = !expanded.has(row.id)
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(row.id)) next.delete(row.id)
      else next.add(row.id)
      return next
    })
    // Only on the way open, and only once — a collapse needs nothing fetched.
    if (willOpen) void loadVoucher(row)
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
          <p className="text-sm text-gray-500">
            Every AP payment recorded, across all bills — the register of what left the bank.
          </p>
        </div>
        <div className="flex gap-2">
          {/* Scenario 46 Part F — this page was read-only with no way to
              create anything. Payment starts here as well as from AP Invoices. */}
          <Link
            href="/accounting/ap-bills/payments/new"
            className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
          >
            <Plus className="h-4 w-4" /> Record Payment
          </Link>
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
              <th className="w-8 px-3 py-2" />
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Voucher #</th>
              <th className="px-3 py-2 text-left">Payee</th>
              <th className="px-3 py-2 text-left">Paid from</th>
              <th className="px-3 py-2 text-left">Reference</th>
              <th className="px-3 py-2 text-left">Invoices</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Print</th>
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
                  No payments recorded yet.
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const open = expanded.has(row.id)
                return (
                  <Fragment key={row.id}>
                    <tr onClick={() => toggle(row)} className="cursor-pointer hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400">
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{fmtDate(row.paymentDate)}</td>
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-prominent-purple-900">
                        {row.voucherNumber ?? '—'}
                      </td>
                      <td className="px-3 py-2">{row.payee ?? '—'}</td>
                      <td className="px-3 py-2">
                        {row.sources.length > 1
                          ? `${row.sources.length} methods`
                          : (row.bankAccount?.name ?? row.method ?? '—')}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.reference ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {row.invoices.length === 1
                          ? (row.invoices[0].billNumber ?? '—')
                          : `${row.invoices.length} invoices`}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {fmtMoney(row.amount)}
                      </td>
                      {/* Scenario 46 Part F — any voucher can be reopened as a
                          PDF from here, which is the read-only "what was paid"
                          view. One document for the whole transaction. */}
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            printVoucher(row)
                          }}
                          disabled={printingFor === row.id}
                          title="Print voucher"
                          aria-label="Print voucher"
                          className="rounded p-1.5 text-sky-600 hover:bg-sky-50 disabled:opacity-50"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>

                    {open && (
                      <tr className="bg-gray-50/60">
                        <td />
                        <td colSpan={8} className="px-3 pb-4 pt-0">
                          {/* The voucher, in place. It already carries the
                              invoices it settled and what funded it, which is
                              exactly what the two hand-rolled lists here used
                              to say — only in the shape the paper uses. */}
                          {voucherDocs[row.id] ? (
                            <VoucherDocument
                              envelope={voucherDocs[row.id]}
                              onOpenInvoice={(billId) =>
                                router.push(`/accounting/ap-bills/${billId}`)
                              }
                            />
                          ) : (
                            <p className="py-3 text-[13px] text-gray-400">Loading voucher…</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
