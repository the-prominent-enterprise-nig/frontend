'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Loader2, Printer } from 'lucide-react'
import { ARInvoices, fmtMoney, type ARInvoiceDocument } from '@/src/libs/data/AccountingV2Data'
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
    </div>
  )
}
