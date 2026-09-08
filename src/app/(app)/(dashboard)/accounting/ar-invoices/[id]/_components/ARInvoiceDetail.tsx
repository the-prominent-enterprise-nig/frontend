'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ChevronDown, Download, Loader2 } from 'lucide-react'
import {
  ARInvoices,
  fmtMoney,
  fmtDate,
  type ARInvoiceDocument,
  type ARInvoiceDue,
  type ARInvoiceMemo,
} from '@/src/libs/data/AccountingV2Data'
import { printARInvoiceDocument } from '@/src/libs/print/printInventoryDocument'
import CollectionReceiptSheet, {
  CollectionReceiptDocumentSheet,
  type CollectionReceiptDocument,
} from '../../_components/CollectionReceiptSheet'

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

/** A due's own state. The dues of a plan all hang off ONE invoice, so this
 * cannot be read off an invoice status the way it could when each due had its
 * own — it comes from the due's settlement columns, plus the calendar for
 * anything still open. */
function dueStatus(d: ARInvoiceDue, isNext: boolean): { label: string; className: string } {
  if (d.settledAt) return { label: 'Paid', className: 'bg-emerald-50 text-emerald-700' }
  if (Number(d.paidAmount) > 0) return { label: 'Partial', className: 'bg-amber-50 text-amber-700' }
  // Compared against the START of today, so a due dated today is not already
  // Overdue by a few hours.
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const dueDay = new Date(d.dueDate)
  dueDay.setHours(0, 0, 0, 0)
  if (dueDay.getTime() < startOfToday.getTime())
    return { label: 'Overdue', className: 'bg-red-50 text-red-700' }
  // "Due" is the one being collected NEXT, not merely one whose date has
  // arrived — collections settle oldest-first, so exactly one open due is
  // ever the live one. Everything behind it is simply Upcoming.
  if (isNext) return { label: 'Due', className: 'bg-prominent-purple-50 text-prominent-purple-700' }
  return { label: 'Upcoming', className: 'bg-gray-100 text-gray-600' }
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

const MEMO_TYPE_LABELS: Record<string, string> = {
  sales_return: 'Sales Return',
  billing_adjustment: 'Billing Adjustment',
  goodwill: 'Goodwill',
}

/** One credit or debit memo against this invoice. Direction is what the
 *  reader actually needs: a credit paid the invoice down, a debit added to
 *  it, and the sign is the fastest way to say which. */
function MemoRow({ memo, direction }: { memo: ARInvoiceMemo; direction: 'credit' | 'debit' }) {
  const isVoided = memo.status !== 'ISSUED'
  return (
    <li className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/accounting/${direction}-memos`}
            className="font-mono text-[13px] text-prominent-purple-700 hover:underline"
          >
            {memo.memoNumber}
          </Link>
          <span className="text-[11px] text-gray-500">
            {MEMO_TYPE_LABELS[memo.type] ?? memo.type}
          </span>
          {isVoided && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase text-gray-500">
              {memo.status}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-gray-500">
          {fmtDate(memo.memoDate)}
          {memo.reason ? ` · ${memo.reason}` : ''}
        </div>
      </div>
      <span
        className={`shrink-0 font-semibold tabular-nums ${
          isVoided ? 'text-gray-400 line-through' : 'text-gray-900'
        }`}
      >
        {direction === 'credit' ? '−' : '+'}
        {fmtMoney(memo.amount)}
      </span>
    </li>
  )
}

export default function ARInvoiceDetail({ id }: { id: string }) {
  const [doc, setDoc] = useState<ARInvoiceDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // The collection receipts issued against this invoice — the down payment
  // and every monthly collection after it. Each is its own document with its
  // own balance, so they are fetched per payment rather than derived here.
  const [receipts, setReceipts] = useState<CollectionReceiptDocument[]>([])
  // Which payment row is currently showing its receipt. One at a time: these
  // are full-page documents, and two open at once reads as one long sheet.
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null)

  useEffect(() => {
    // The document envelope is a superset of GET /ar-invoices/:id — it adds
    // the enterprise letterhead block — so one fetch backs both this view
    // and the Print button.
    let cancelled = false
    ARInvoices.getDocument(id).then((res) => {
      if (cancelled) return
      if (res.success && res.data) {
        setDoc(res.data)
        // Oldest first, so the receipts read in the order they were issued
        // and each one's Previous Balance follows on from the last.
        const payments = [...(res.data.document.payments ?? [])]
          .filter((p) => !p.cancelledAt)
          .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime())
        Promise.all(payments.map((p) => ARInvoices.getReceiptDocument(id, p.id))).then(
          (results) => {
            if (cancelled) return
            setReceipts(
              results
                .filter((r) => r.success && r.data)
                .map((r) => r.data as CollectionReceiptDocument)
            )
          }
        )
      } else setError(res.error ?? 'Invoice not found')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
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
  // getReceiptDocument() sets document.id to the ARPayment it was built for,
  // which is what pairs a fetched receipt back to its row below.
  const receiptByPaymentId = new Map(
    receipts.filter((r) => r.document.id).map((r) => [r.document.id as string, r])
  )
  const creditMemos = invoice.creditMemos ?? []
  const debitMemos = invoice.debitMemos ?? []
  const outstanding = invoice.totalAmount - invoice.amountPaid
  // The due collections will settle next — the earliest still unsettled.
  const nextDueLineNumber = detail?.dues?.find((d) => !d.settledAt)?.lineNumber ?? null
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
      </div>

      {/* The receivable at a glance. One installment sale is ONE invoice, so
          these three numbers describe the whole contract: what was billed,
          what has been collected against it (the down payment included), and
          what the customer still owes. */}
      <section className="mt-3 rounded-lg border border-gray-200 bg-white p-5">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Total billed
            </dt>
            <dd className="mt-1 text-[18px] font-semibold tabular-nums text-prominent-purple-900">
              {fmtMoney(invoice.totalAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Amount paid
            </dt>
            <dd className="mt-1 text-[18px] font-semibold tabular-nums text-emerald-700">
              {fmtMoney(invoice.amountPaid)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Outstanding
            </dt>
            <dd className="mt-1 text-[18px] font-semibold tabular-nums text-prominent-purple-900">
              {fmtMoney(outstanding)}
            </dd>
            {/* Scenario 29 ACC-05 — Outstanding is everything still owed;
                this is the slice that has actually matured. */}
            {due > 0 && (
              <p className="mt-0.5 text-[11px] text-gray-500">{fmtMoney(due)} of it already due</p>
            )}
          </div>
        </dl>
      </section>

      {/* The invoice document. It used to render titled "Collection Receipt"
          — the same paper as the receipt that settles it — which meant this
          page showed the FULL billed amount under a heading that claims money
          was received. An invoice states what is owed; the receipt states
          what was paid. Its single row is the receivable being billed. */}
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
          title="AR Invoice"
          totalLabel="Amount Billed"
        />
      </div>

      {/* The collection receipts used to be stacked here in full, one sheet
          per payment, below the invoice. On a 12-month plan that pushed the
          schedule and the memos off the bottom of the page behind a dozen
          near-identical documents — and it put records of money RECEIVED
          inside the document view of the BILL, which is what this page's
          own sheet above is. Each receipt now opens from its row in
          Payments / collections below, where the reader is already asking
          "which collection was that?". */}

      {/* The financing plan behind this due — item lines, serials and their
          receiving provenance. None of it appears on the client's Collection
          Receipt, which is a one-line account document, so it sits here. */}
      {detail && (
        <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-[14px] font-semibold text-prominent-purple-900">
            Financed items — full plan
          </h2>
          <p className="mb-3 text-[12px] text-gray-500">
            Everything financed on this {detail.termMonths ?? '—'}-month plan. This invoice is the
            receivable for the whole contract, billed out over the schedule below.
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
          Payments / collections
        </h2>
        {payments.length === 0 && (
          <p className="py-4 text-center text-[13px] text-gray-400">No payments recorded yet.</p>
        )}
        {payments.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {payments.map((p) => {
              // A cancelled application has no receipt document fetched for
              // it, so its row stays inert rather than opening an empty
              // dropdown.
              const receipt = receiptByPaymentId.get(p.id)
              const expanded = openReceiptId === p.id
              return (
                <li key={p.id} className="py-2.5 text-[13px]">
                  <button
                    type="button"
                    disabled={!receipt}
                    aria-expanded={expanded}
                    onClick={() => setOpenReceiptId(expanded ? null : p.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-md text-left ${
                      receipt
                        ? 'cursor-pointer px-1.5 py-1 hover:bg-gray-50'
                        : 'cursor-default px-1.5 py-1'
                    }`}
                  >
                    <div>
                      <div className="text-gray-800">
                        {fmtDate(p.paymentDate)}
                        {p.method ? ` · ${p.method}` : ''}
                        {/* CR number off the booklet first; the generated
                        CR-YYYYMMDD-NNNN backs it up. `receiptNumber` is
                        always present when there is one — `receipt` only
                        appears when the payment also settled OTHER
                        invoices. */}
                        {p.reference
                          ? ` · ${p.reference}`
                          : (p.receiptNumber ?? p.receipt?.number)
                            ? ` · ${p.receiptNumber ?? p.receipt?.number}`
                            : ''}
                        {/* The down payment settles no single month — it credits
                        the contract as a whole — so it is named rather than
                        left to read as an ordinary monthly collection. */}
                        {p.isDownPayment && (
                          <span className="ml-2 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 ring-1 ring-inset ring-purple-200">
                            Downpayment
                          </span>
                        )}
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
                    <span className="flex shrink-0 items-center gap-2 font-semibold tabular-nums text-gray-900">
                      {fmtMoney(p.amount + p.withholdingAmount)}
                      {receipt && (
                        <ChevronDown
                          aria-hidden
                          className={`h-4 w-4 text-gray-400 transition-transform ${
                            expanded ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </span>
                  </button>
                  {/* The receipt itself — what was actually received, and the
                    balance it left behind. Rendered only for the row the
                    reader opened, so the page stays the invoice's. */}
                  {expanded && receipt && (
                    <div className="mt-3">
                      <CollectionReceiptDocumentSheet doc={receipt} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* The plan itself. These dues are NOT invoices — they all hang off the
          single receivable above — so each one's state comes from its own
          settlement columns rather than from an invoice status. */}
      {detail?.dues && detail.dues.length > 0 && (
        <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-[14px] font-semibold text-prominent-purple-900">
            Installment schedule
          </h2>
          <p className="mb-3 text-[12px] text-gray-500">
            The {detail.dues.length} monthly dues this receivable is billed out over. Collections
            settle them oldest first.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-[13px]">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Due date</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th className="py-2 pr-4 text-right">Paid</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detail.dues.map((d) => {
                  const status = dueStatus(d, d.lineNumber === nextDueLineNumber)
                  return (
                    <tr key={d.lineNumber}>
                      <td className="py-2 pr-4 tabular-nums text-gray-500">#{d.lineNumber}</td>
                      <td className="py-2 pr-4 text-gray-900">{fmtDate(d.dueDate)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-gray-900">
                        {fmtMoney(Number(d.amount))}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-gray-500">
                        {Number(d.paidAmount) > 0 ? fmtMoney(Number(d.paidAmount)) : '—'}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* A credit memo moves amountPaid without any money changing hands, so
          without this the balance appears to drop for no reason — which is
          exactly what a customer return does to an invoice. */}
      {(creditMemos.length > 0 || debitMemos.length > 0) && (
        <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-[14px] font-semibold text-prominent-purple-900">
            Credits &amp; adjustments
          </h2>
          <ul className="divide-y divide-gray-100">
            {creditMemos.map((m) => (
              <MemoRow key={m.id} memo={m} direction="credit" />
            ))}
            {debitMemos.map((m) => (
              <MemoRow key={m.id} memo={m} direction="debit" />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
