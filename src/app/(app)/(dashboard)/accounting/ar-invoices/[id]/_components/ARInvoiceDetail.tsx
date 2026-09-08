'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Download, Loader2, Printer } from 'lucide-react'
import {
  ARInvoices,
  fmtMoney,
  fmtDate,
  type ARInvoiceDocument,
  type ARInvoiceMemo,
} from '@/src/libs/data/AccountingV2Data'
import { printARInvoiceDocument } from '@/src/libs/print/printInventoryDocument'
import CollectionReceiptSheet from '../../_components/CollectionReceiptSheet'
import InstallmentScheduleTable from '../../_components/InstallmentScheduleTable'
import CollectionReceiptsTable from '../../_components/CollectionReceiptsTable'

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

/** Names a due the way the rest of this page does ("Payment 2 of 12")
 * rather than by its raw INST-POS-… number. A receipt can also settle a
 * plain standalone invoice with no installment line — that falls back to
 * the invoice number, so a mixed receipt reads correctly either way. */

/** en-PH numeric date, as the account line has always shown it. */
function docDate(v: string | Date | null | undefined): string {
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
  const creditMemos = invoice.creditMemos ?? []
  const debitMemos = invoice.debitMemos ?? []
  const outstanding = invoice.totalAmount - invoice.amountPaid

  // Start of today, so a due dated today reads as due rather than late.
  const todayStart = (() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  })()

  // What the collector should chase next. On a plan that's the earliest
  // unsettled due; on a charge invoice the invoice's own due date is the
  // whole story.
  const openLines = [...(invoice.scheduleLines ?? [])]
    .filter((l) => !l.settledAt)
    .sort((a, b) => a.lineNumber - b.lineNumber)
  const overdueCount = openLines.filter((l) => new Date(l.dueDate).getTime() < todayStart).length

  const nextDue = (() => {
    const fmt = (v: string) =>
      new Date(v).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    const describe = (dateStr: string, amount: number) => {
      const ms = todayStart - new Date(dateStr).getTime()
      const days = Math.floor(ms / 86_400_000)
      return {
        amount,
        overdue: days > 0,
        label: days > 0 ? `${fmt(dateStr)} · ${days}d overdue` : `Due ${fmt(dateStr)}`,
      }
    }
    const line = openLines[0]
    if (line) {
      return describe(line.dueDate, Math.round((line.amount - line.paidAmount) * 100) / 100)
    }
    // Charge invoice, or a plan with every due settled.
    if ((invoice.scheduleLines?.length ?? 0) === 0 && outstanding > 0) {
      return describe(invoice.dueDate, outstanding)
    }
    return null
  })()

  // A plan-level label. The raw enum ("SENT") says nothing useful about a
  // twelve-month plan halfway through collection.
  const planLabel =
    outstanding <= 0.01
      ? 'Paid'
      : overdueCount > 0
        ? `Overdue (${overdueCount})`
        : nextDue?.overdue
          ? 'Due now'
          : openLines.length > 0 || invoice.status !== 'DRAFT'
            ? 'On track'
            : invoice.status

  // Sale first, then every collection in date order. Cancelled applications
  // are left out: they never reduced the balance, so showing them would make
  // the running total disagree with Outstanding above it.
  const scheduleLineNumber = new Map((invoice.scheduleLines ?? []).map((l) => [l.id, l.lineNumber]))
  const isPlan = (invoice.scheduleLines?.length ?? 0) > 0
  const statementRows = [
    {
      date: invoice.invoiceDate,
      ref: invoice.posTransaction?.salesInvoiceNumber || invoice.invoiceNumber,
      // The opening debit is the whole contract being billed — named for what
      // it is rather than echoing the invoice's free-text description.
      description: 'AR Invoice',
      debit: invoice.totalAmount,
      credit: 0,
    },
    ...(invoice.payments ?? [])
      .filter((p) => !p.cancelledAt)
      .slice()
      .sort((a, b) => +new Date(a.paymentDate) - +new Date(b.paymentDate))
      .map((p) => {
        const due = p.installmentScheduleLineId
          ? scheduleLineNumber.get(p.installmentScheduleLineId)
          : undefined
        return {
          date: p.paymentDate,
          ref: p.receipt?.number ?? p.reference ?? null,
          description: due ? `Installment #${due}` : isPlan ? 'Downpayment' : 'Payment',
          debit: 0,
          // Withholding and rebate discharge the debt just as cash does, so
          // the balance has to fall by all three or it will never reach zero.
          credit:
            Math.round((p.amount + (p.withholdingAmount ?? 0) + (p.rebateAmount ?? 0)) * 100) / 100,
        }
      }),
  ]
  // Scenario 29 ACC-05 — Outstanding is the total owed regardless of
  // maturity; Due only counts it once this invoice's own due date has
  // passed (the collector's number).

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
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      <div className="mt-3">
        <CollectionReceiptSheet
          customer={invoice.customer}
          enterprise={enterprise}
          date={invoice.invoiceDate}
          reference={invoice.posTransaction?.salesInvoiceNumber || invoice.invoiceNumber}
          description={invoice.description}
          rows={[
            {
              accountLine: `Accounts Receivable — ${invoice.customer?.name ?? '—'} — ${invoice.invoiceNumber} — ${docDate(invoice.dueDate)}`,
              amount: invoice.totalAmount,
            },
          ]}
          total={invoice.totalAmount}
          title="AR Invoice"
        />
      </div>

      {/* The four questions this page exists to answer, before any document:
          how much was billed, how much has been paid, how much is left, and
          which installment is due next. These were previously a run of small
          grey text a reader had to parse left to right. */}
      <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white px-3.5 py-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Total billed
          </dt>
          <dd className="mt-0.5 text-[17px] font-bold tabular-nums text-prominent-purple-900">
            {fmtMoney(invoice.totalAmount)}
          </dd>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3.5 py-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Amount paid
          </dt>
          <dd className="mt-0.5 text-[17px] font-bold tabular-nums text-emerald-700">
            {fmtMoney(invoice.amountPaid)}
          </dd>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-3.5 py-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Outstanding
          </dt>
          <dd
            className={`mt-0.5 text-[17px] font-bold tabular-nums ${
              outstanding > 0 ? 'text-prominent-purple-900' : 'text-emerald-700'
            }`}
          >
            {fmtMoney(outstanding)}
          </dd>
        </div>
        <div
          className={`rounded-lg border px-3.5 py-3 ${
            nextDue?.overdue ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
          }`}
        >
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            {nextDue?.overdue ? 'Overdue' : 'Next due'}
          </dt>
          {nextDue ? (
            <>
              <dd
                className={`mt-0.5 text-[17px] font-bold tabular-nums ${
                  nextDue.overdue ? 'text-red-700' : 'text-prominent-purple-900'
                }`}
              >
                {fmtMoney(nextDue.amount)}
              </dd>
              <dd className={`text-[11.5px] ${nextDue.overdue ? 'text-red-600' : 'text-gray-500'}`}>
                {nextDue.label}
              </dd>
            </>
          ) : (
            <dd className="mt-0.5 text-[17px] font-bold text-emerald-700">Settled</dd>
          )}
        </div>
      </dl>

      {/* Record data the paper document doesn't carry — kept outside the sheet
          so the sheet itself stays a faithful preview of what prints. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${INVOICE_STATUS_BADGE[invoice.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {invoice.status === 'PAID' && <CheckCircle2 className="h-3 w-3" />}
          {planLabel}
        </span>
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
        <span>Invoice {invoice.invoiceNumber}</span>
      </div>

      <InstallmentScheduleTable
        lines={invoice.scheduleLines ?? []}
        payments={invoice.payments ?? []}
      />

      <CollectionReceiptsTable
        invoiceId={invoice.id}
        payments={invoice.payments ?? []}
        scheduleLines={invoice.scheduleLines ?? []}
        customer={invoice.customer}
        enterprise={enterprise}
        appliedToReference={invoice.posTransaction?.salesInvoiceNumber || invoice.invoiceNumber}
        invoiceDate={invoice.invoiceDate}
        totalAmount={invoice.totalAmount}
        saleReference={invoice.posTransaction?.transactionNumber || invoice.invoiceNumber}
      />
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
