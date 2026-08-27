'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Download, Loader2 } from 'lucide-react'
import { ARInvoices, fmtMoney, fmtDate, type ARInvoice } from '@/src/libs/data/AccountingV2Data'
import { printARInvoiceDocument } from '@/src/libs/print/printInventoryDocument'

// Mirrors ARInvoicesList's own INVOICE_STATUS_BADGE — kept local rather
// than imported from there so this page doesn't pull in that file's much
// heavier client-component tree (react-hook-form, item/serial comboboxes)
// just for a 5-entry color map.
const INVOICE_STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-50 text-blue-700',
  PARTIAL: 'bg-amber-50 text-amber-700',
  OVERDUE: 'bg-red-50 text-red-700',
  PAID: 'bg-emerald-50 text-emerald-700',
}

export default function ARInvoiceDetail({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<ARInvoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    ARInvoices.get(id).then((res) => {
      if (res.success && res.data) setInvoice(res.data)
      else setError(res.error ?? 'Invoice not found')
      setLoading(false)
    })
  }, [id])

  async function handleDownload() {
    setDownloading(true)
    const res = await ARInvoices.getDocument(id)
    setDownloading(false)
    if (res.success && res.data) printARInvoiceDocument(res.data)
  }

  if (loading) {
    return <div className="px-4 py-6 text-gray-400 sm:px-6 lg:px-10 lg:py-8">Loading invoice…</div>
  }

  if (error || !invoice) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <Link
          href="/accounting/ar-invoices"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to AR Invoices
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  const outstanding = invoice.totalAmount - invoice.amountPaid
  // Scenario 29 ACC-05 — Outstanding is the total owed regardless of
  // maturity; Due only counts it once this invoice's own due date has
  // passed (the collector's number).
  const due = new Date(invoice.dueDate) <= new Date() ? Math.max(outstanding, 0) : 0

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
      <Link
        href="/accounting/ar-invoices"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to AR Invoices
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{invoice.invoiceNumber}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            {invoice.customer?.name}
            {invoice.installmentDetail?.lineNumber != null &&
              invoice.installmentDetail.termMonths && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  Payment {invoice.installmentDetail.lineNumber} of{' '}
                  {invoice.installmentDetail.termMonths}
                </span>
              )}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${INVOICE_STATUS_BADGE[invoice.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {invoice.status === 'PAID' && <CheckCircle2 className="h-4 w-4" />}
              {invoice.status}
            </span>
            {invoice.status === 'OVERDUE' && (
              <span className="text-xs font-medium text-red-500">
                {Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / 86400000)} days
                overdue
              </span>
            )}
          </div>
          <div className="mt-2 grid max-w-xs grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1.5 text-sm">
            {invoice.posTransaction && (
              <>
                <span className="text-gray-500">Source sale</span>
                <span className="text-left font-medium">
                  <Link
                    href={`/pos/transactions?search=${encodeURIComponent(invoice.posTransaction.transactionNumber)}`}
                    className="text-purple-600 hover:underline"
                  >
                    {invoice.posTransaction.transactionNumber}
                  </Link>
                </span>
              </>
            )}
            <span className="text-gray-500">Invoice date</span>
            <span className="text-left font-medium tabular-nums text-gray-800">
              {fmtDate(invoice.invoiceDate)}
            </span>
            <span className="text-gray-500">Due date</span>
            <span className="text-left font-medium tabular-nums text-gray-800">
              {fmtDate(invoice.dueDate)}
            </span>
            <span className="text-gray-500">Subtotal</span>
            <span className="text-left font-medium tabular-nums text-gray-800">
              {fmtMoney(invoice.subtotal)}
            </span>
            <span className="text-gray-500">Tax</span>
            <span className="text-left font-medium tabular-nums text-gray-800">
              {fmtMoney(invoice.taxAmount)}
            </span>
            <span className="border-t border-gray-100 pt-1.5 font-semibold text-gray-600">
              Total
            </span>
            <span className="border-t border-gray-100 pt-1.5 text-left font-semibold tabular-nums text-gray-900">
              {fmtMoney(invoice.totalAmount)}
            </span>
          </div>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-xl bg-prominent-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Print / Download
        </button>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Total" value={fmtMoney(invoice.totalAmount)} />
        <StatBox label="Paid" value={fmtMoney(invoice.amountPaid)} />
        <StatBox label="Outstanding" value={fmtMoney(outstanding)} emphasize={outstanding > 0} />
        <StatBox label="Due now" value={due > 0 ? fmtMoney(due) : '—'} emphasize={due > 0} />
      </div>

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-[14px] font-semibold text-gray-900">
          {invoice.installmentDetail ? 'Financed items — full plan' : 'Items'}
        </h2>
        {invoice.installmentDetail && (
          <p className="mb-3 text-xs text-gray-500">
            Full price of everything on this {invoice.installmentDetail.termMonths ?? '—'}-month
            plan — this invoice only covers 1 of {invoice.installmentDetail.termMonths ?? '—'}{' '}
            monthly payments, not the full amount shown below.
          </p>
        )}
        {!invoice.installmentDetail && (
          <p className="py-6 text-center text-[13px] text-gray-400">
            No item breakdown for this invoice.
          </p>
        )}
        {invoice.installmentDetail && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="py-2 pr-4">Item</th>
                    <th className="py-2 pr-4 text-right">Qty</th>
                    <th className="py-2 pr-4 text-right">Unit price</th>
                    <th className="py-2 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoice.installmentDetail.items.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2 pr-4 text-gray-900">
                        {l.item?.name ?? '—'}
                        {l.item?.brand ? (
                          <span className="text-gray-500"> — {l.item.brand.name}</span>
                        ) : null}
                        {l.serialNumber && (
                          <p className="text-sm font-semibold text-purple-600">
                            SN: {l.serialNumber.serialNumber}
                            {l.secondarySerialNumber &&
                              ` / ${l.secondarySerialNumber.serialNumber}`}
                          </p>
                        )}
                        {l.serialNumber?.goodsReceiptLine?.goodsReceipt && (
                          <p className="font-mono text-[10px] text-gray-400">
                            RR: {l.serialNumber.goodsReceiptLine.goodsReceipt.code}
                            {l.serialNumber.goodsReceiptLine.goodsReceipt.supplier &&
                              ` — ${l.serialNumber.goodsReceiptLine.goodsReceipt.supplier.name}`}
                            {l.serialNumber.goodsReceiptLine.goodsReceipt.purchaseOrderNumber &&
                              ` · PO: ${l.serialNumber.goodsReceiptLine.goodsReceipt.purchaseOrderNumber}`}
                          </p>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right">{l.quantity}</td>
                      <td className="py-2 pr-4 text-right">{fmtMoney(Number(l.unitPrice))}</td>
                      <td className="py-2 text-right">{fmtMoney(l.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-right text-[13px] text-gray-600">
              Rebate on this due date:{' '}
              <span className="font-semibold">
                {fmtMoney(Number(invoice.installmentDetail.rebate ?? 0))}
              </span>
            </p>
          </>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-[14px] font-semibold text-gray-900">Payment history</h2>
        {(!invoice.payments || invoice.payments.length === 0) && (
          <p className="py-4 text-center text-[13px] text-gray-400">No payments recorded yet.</p>
        )}
        {invoice.payments && invoice.payments.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <div>
                  <div className="text-gray-800">
                    {fmtDate(p.paymentDate)}
                    {p.method ? ` · ${p.method}` : ''}
                    {p.reference ? ` · ${p.reference}` : ''}
                    {p.cancelledAt && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 ring-1 ring-inset ring-gray-200">
                        cancelled
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                  {fmtMoney(p.amount + p.withholdingAmount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StatBox({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${emphasize ? 'text-red-600' : 'text-gray-900'}`}
      >
        {value}
      </p>
    </div>
  )
}
