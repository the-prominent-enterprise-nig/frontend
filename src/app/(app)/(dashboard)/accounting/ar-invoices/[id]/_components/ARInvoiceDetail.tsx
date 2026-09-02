'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Download, Loader2 } from 'lucide-react'
import {
  ARInvoices,
  fmtMoney,
  fmtDate,
  type ARInvoiceDocument,
} from '@/src/libs/data/AccountingV2Data'
import { printARInvoiceDocument } from '@/src/libs/print/printInventoryDocument'
import CollectionReceiptSheet from '../../_components/CollectionReceiptSheet'

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

/** en-PH numeric date (09/02/2026) — the format the printed document uses. */
function docDate(v: string | Date | undefined | null): string {
  return v ? new Date(v).toLocaleDateString('en-PH') : '—'
}

/** Names a due the way the rest of this page does ("Payment 2 of 12")
 * rather than by its raw INST-POS-… number. A receipt can also settle a
 * plain standalone invoice with no installment line — that falls back to
 * the invoice number, so a mixed receipt reads correctly either way. */
function dueLabel(s: {
  invoiceNumber: string
  lineNumber: number | null
  termMonths: number | null
}) {
  return s.lineNumber != null && s.termMonths
    ? `Payment ${s.lineNumber} of ${s.termMonths}`
    : s.invoiceNumber
}

export default function ARInvoiceDetail({ id }: { id: string }) {
  const [doc, setDoc] = useState<ARInvoiceDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // The document envelope is a superset of GET /ar-invoices/:id — it adds
    // the enterprise letterhead block — so one fetch backs both this view
    // and the Print button.
    ARInvoices.getDocument(id).then((res) => {
      if (res.success && res.data) setDoc(res.data)
      else setError(res.error ?? 'Invoice not found')
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-gray-400 sm:px-6 lg:px-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading invoice…
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
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

  const invoice = doc.document
  const enterprise = doc.enterprise
  const detail = invoice.installmentDetail
  const payments = invoice.payments ?? []
  const outstanding = invoice.totalAmount - invoice.amountPaid
  // Scenario 29 ACC-05 — Outstanding is the total owed regardless of
  // maturity; Due only counts it once this invoice's own due date has
  // passed (the collector's number).
  const due = new Date(invoice.dueDate) <= new Date() ? Math.max(outstanding, 0) : 0
  const daysOverdue = Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / 86400000)

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/accounting/ar-invoices"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to AR Invoices
        </Link>
        <button
          onClick={() => printARInvoiceDocument(doc)}
          className="inline-flex items-center gap-1.5 rounded-md bg-prominent-orange-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-prominent-orange-700"
        >
          <Download className="h-4 w-4" />
          Print / Download
        </button>
      </div>

      {/* Record data the paper document doesn't carry — kept outside the sheet
          so the sheet itself stays a faithful preview of what prints. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${INVOICE_STATUS_BADGE[invoice.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {invoice.status === 'PAID' && <CheckCircle2 className="h-3 w-3" />}
          {invoice.status}
        </span>
        {detail?.lineNumber != null && detail.termMonths && (
          <span>
            Payment {detail.lineNumber} of {detail.termMonths}
          </span>
        )}
        {invoice.posTransaction && (
          <span>
            Source sale{' '}
            <Link
              href={`/pos/transactions?search=${encodeURIComponent(invoice.posTransaction.transactionNumber)}`}
              className="text-purple-600 hover:underline"
            >
              {invoice.posTransaction.transactionNumber}
            </Link>
          </span>
        )}
        {invoice.status === 'OVERDUE' && daysOverdue > 0 && (
          <span className="font-medium text-red-500">{daysOverdue} days overdue</span>
        )}
        <span>Paid {fmtMoney(invoice.amountPaid)}</span>
        <span className={outstanding > 0 ? 'font-medium text-gray-700' : ''}>
          Outstanding {fmtMoney(outstanding)}
        </span>
        {due > 0 && <span>Due now {fmtMoney(due)}</span>}
      </div>

      {/* The document itself — the same component the Receipts list previews,
          so an invoice and the receipt that settles it are the same paper.
          Its single row is the receivable being billed. */}
      <div className="mt-2.5">
        <CollectionReceiptSheet
          customer={invoice.customer}
          enterprise={enterprise}
          date={invoice.invoiceDate}
          reference={invoice.invoiceNumber}
          description={invoice.description}
          rows={[
            {
              accountLine: `Accounts Receivable — ${invoice.customer?.name ?? '—'} — ${invoice.invoiceNumber} — ${docDate(invoice.dueDate)}`,
              amount: invoice.totalAmount,
            },
          ]}
          total={invoice.totalAmount}
        />
      </div>

      {/* The financing plan behind this due — item lines, serials and their
          receiving provenance. None of it appears on the client's Collection
          Receipt, which is a one-line account document, so it sits here. */}
      {detail && (
        <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-[14px] font-semibold text-prominent-purple-900">
            Financed items — full plan
          </h2>
          <p className="mb-3 text-[12px] text-gray-500">
            Full price of everything on this {detail.termMonths ?? '—'}-month plan — this invoice
            only covers 1 of {detail.termMonths ?? '—'} monthly payments, not the full amount shown
            below.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-[13px]">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Item</th>
                  <th className="py-2 pr-4 text-right">Qty</th>
                  <th className="py-2 pr-4 text-right">Unit price</th>
                  <th className="py-2 text-right">Line total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detail.items.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-4 text-gray-900">
                      {l.item?.name ?? '—'}
                      {l.item?.brand ? (
                        <span className="text-gray-500"> — {l.item.brand.name}</span>
                      ) : null}
                      {l.serialNumber && (
                        <p className="font-mono text-[11px] text-purple-600">
                          SN: {l.serialNumber.serialNumber}
                          {l.secondarySerialNumber && ` / ${l.secondarySerialNumber.serialNumber}`}
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
                    <td className="py-2 pr-4 text-right tabular-nums">{l.quantity}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {fmtMoney(Number(l.unitPrice))}
                    </td>
                    <td className="py-2 text-right tabular-nums">{fmtMoney(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-right text-[13px] text-gray-600">
            Rebate on this due date:{' '}
            <span className="font-semibold">{fmtMoney(Number(detail.rebate ?? 0))}</span>
          </p>
        </section>
      )}

      {/* Also outside the sheet: the payment record — the method, cancelled
          applications, and which wider receipt each one came out of — none of
          which the printed invoice carries. */}
      <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-[14px] font-semibold text-prominent-purple-900">
          Payment history
        </h2>
        {payments.length === 0 && (
          <p className="py-4 text-center text-[13px] text-gray-400">No payments recorded yet.</p>
        )}
        {payments.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <div>
                  <div className="text-gray-800">
                    {fmtDate(p.paymentDate)}
                    {p.method ? ` · ${p.method}` : ''}
                    {/* CR number off the booklet first; the generated
                        CR-YYYYMMDD-NNNN only backs up older payments. */}
                    {p.reference
                      ? ` · ${p.reference}`
                      : p.receipt?.number
                        ? ` · ${p.receipt.number}`
                        : ''}
                    {p.cancelledAt && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 ring-1 ring-inset ring-gray-200">
                        cancelled
                      </span>
                    )}
                  </div>
                  {/* This amount is only a slice of a wider payment — show
                      what the whole payment was and which other dues it
                      cleared, so the figure doesn't read as unrelated to the
                      rest of the schedule. */}
                  {p.receipt && p.receipt.settledOthers.length > 0 && (
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      Part of a {fmtMoney(p.receipt.amount)} payment · also settled{' '}
                      {p.receipt.settledOthers
                        .slice(0, 3)
                        .map((s) => dueLabel(s))
                        .join(', ')}
                      {p.receipt.settledOthers.length > 3 &&
                        ` +${p.receipt.settledOthers.length - 3} more`}
                    </div>
                  )}
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
