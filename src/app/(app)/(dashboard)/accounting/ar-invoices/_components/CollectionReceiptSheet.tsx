'use client'

import { fmtMoney } from '@/src/libs/data/AccountingV2Data'

// Same cell chrome as buildCollectionReceiptHtml()'s `th, td { border: 1px
// solid #ccc }` so the on-screen document and the printed one read as the
// same paper. This is the client's own AR document layout: customer left,
// Date/Reference centre, enterprise right, an uppercase description line,
// then a numbered Account/Total table.
const TH = 'border border-gray-300 bg-gray-100 px-2.5 py-[7px] text-left font-bold'
const TD = 'border border-gray-300 px-2.5 py-[7px] align-top'

/** en-PH numeric date (09/02/2026) — the format the printed document uses. */
function docDate(v: string | Date | undefined | null): string {
  return v ? new Date(v).toLocaleDateString('en-PH') : '—'
}

function MetaPair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <p className="font-bold text-prominent-purple-900">{label}</p>
      <p className="mb-3 text-gray-700">{value}</p>
    </>
  )
}

export interface CollectionReceiptSheetProps {
  customer?: { name?: string | null; address?: string | null; taxId?: string | null } | null
  enterprise?: { companyLegalName?: string | null; address?: string | null } | null
  date: string | Date | null | undefined
  reference: string
  description?: string | null
  /** One row per account the document touches — a receipt that settled
   * several dues has several, an invoice has the single receivable. */
  rows: { accountLine: string; amount: number }[]
  total: number
  /** What this piece of paper IS. Defaults to Collection Receipt for the
   * historical callers; the AR invoice passes "AR Invoice", because a
   * document showing the amount BILLED must not announce itself as a record
   * of money received. */
  title?: string
  /** Label on the totals row — "Amount Billed" on an invoice, "Total" on a
   * receipt. */
  totalLabel?: string
}

export default function CollectionReceiptSheet({
  customer,
  enterprise,
  date,
  reference,
  description,
  rows,
  total,
  title = 'Collection Receipt',
  totalLabel = 'Total',
}: CollectionReceiptSheetProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-6 text-[13px] text-gray-900 sm:px-8 sm:py-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold uppercase text-prominent-purple-900">{title}</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nig-logo.png"
          alt="NIG Marketing"
          className="h-16 w-auto object-contain sm:h-20"
        />
      </div>

      <div className="mt-6 grid gap-7 md:grid-cols-3">
        <div>
          <p className="font-bold text-prominent-purple-900">{customer?.name ?? '—'}</p>
          {customer?.address && <p className="mt-1 text-gray-700">{customer.address}</p>}
          {customer?.taxId && <p className="text-gray-700">TIN: {customer.taxId}</p>}
        </div>
        <div className="text-right">
          <MetaPair label="Date" value={docDate(date)} />
          <MetaPair label="Reference" value={reference || '—'} />
        </div>
        <div className="md:border-l md:border-gray-300 md:pl-7">
          <p className="font-bold text-prominent-purple-900">
            {enterprise?.companyLegalName ?? '—'}
          </p>
          <p className="mt-1 whitespace-pre-line text-gray-700">{enterprise?.address || '—'}</p>
        </div>
      </div>

      {description && (
        <p className="mb-4 mt-6 font-bold uppercase text-prominent-purple-900">{description}</p>
      )}

      <div className={`overflow-x-auto ${description ? '' : 'mt-6'}`}>
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className={`${TH} w-9 text-center`}>#</th>
              <th className={TH}>Account</th>
              <th className={`${TH} w-40 text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.accountLine}-${i}`}>
                <td className={`${TD} text-center`}>{i + 1}</td>
                <td className={TD}>{r.accountLine}</td>
                <td className={`${TD} text-right tabular-nums`}>{fmtMoney(r.amount)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className={`${TD} text-right`} colSpan={2}>
                {totalLabel}
              </td>
              <td className={`${TD} text-right tabular-nums`}>{fmtMoney(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Print/document envelope for one collection receipt (GET
 * /ar-invoices/:id/payments/:paymentId/document).
 *
 * A collection receipt records MONEY RECEIVED. Everything here is therefore
 * about the payment — `amountReceived`, how it was paid, what it was applied
 * to and what is left after it — never the invoice total, which belongs on
 * the invoice. `invoiceAmount` appears only as context for the balance.
 *
 * `lines` is present only on a receipt combined from several applications
 * (one payment action across several dues); such a receipt has no single
 * account summary, since previous/remaining balance differ per invoice. */
export interface CollectionReceiptDocument {
  documentType: string
  documentNumber: string
  generatedAt: string
  enterprise?: { companyLegalName?: string | null; address?: string | null } | null
  document: {
    /** The ARPayment this receipt records. Absent on a combined receipt,
     *  which has no single application to point at. */
    id?: string
    paymentDate: string
    /** System CR number (CR-YYYYMMDD-NNNN). */
    receiptNumber?: string | null
    /** Cashier-entered reference off the booklet. */
    reference: string | null
    /** "Downpayment", "Installment #3", or "Payment". */
    paymentType?: string | null
    method?: string | null
    /** What actually crossed the counter. */
    amountReceived: number
    withholdingAmount?: number
    rebateAmount?: number
    amountInWords?: string | null
    description?: string | null
    invoiceNumber?: string
    invoiceAmount?: number
    relatedDeliveryReceipt?: string | null
    relatedSalesInvoice?: string | null
    previousBalance?: number
    remainingBalance?: number
    customer: { name: string; address: string | null; taxId: string | null }
    lines?: { accountLine: string; amount: number }[]
  }
}

const ROW = 'flex justify-between gap-6 py-[3px]'
const LABEL = 'text-gray-600'
const VALUE = 'text-right font-medium tabular-nums text-gray-900'

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={ROW}>
      <span className={LABEL}>{label}</span>
      <span className={VALUE}>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-300 pt-3">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-prominent-purple-900">
        {title}
      </p>
      {children}
    </div>
  )
}

/** The collection receipt as the customer receives it — money received, what
 * it settled, and the balance it leaves behind. Rendered from the same
 * envelope printCollectionReceiptDocument() prints, so screen and paper
 * cannot drift apart. */
export function CollectionReceiptDocumentSheet({ doc }: { doc: CollectionReceiptDocument }) {
  const r = doc.document
  const grouped = (r.lines?.length ?? 0) > 0
  const money = (n: number) =>
    n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 })
  const longDate = (v: string | null | undefined) =>
    v
      ? new Date(v).toLocaleDateString('en-PH', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '—'

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-6 text-[13px] text-gray-900 sm:px-8 sm:py-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold uppercase text-prominent-purple-900">
          Collection Receipt
        </h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nig-logo.png"
          alt="NIG Marketing"
          className="h-16 w-auto object-contain sm:h-20"
        />
      </div>

      <div className="mt-4 space-y-[3px]">
        <Row label="Customer" value={r.customer?.name ?? '—'} />
        <Row label="Receipt No." value={r.receiptNumber || doc.documentNumber || '—'} />
        <Row label="Date" value={longDate(r.paymentDate)} />
      </div>

      <div className="mt-4 space-y-4">
        <Section title="Payment details">
          {r.paymentType && <Row label="Payment Type" value={r.paymentType} />}
          <Row label="Amount Received" value={money(r.amountReceived)} />
          <Row label="Payment Method" value={r.method ?? '—'} />
          <Row label="Reference No." value={r.reference || r.receiptNumber || '—'} />
          {/* Shown only when they exist: both reduce the balance without
              being money received, so a zero line would invite the reader to
              reconcile a figure that isn't part of this collection. */}
          {!!r.withholdingAmount && (
            <Row label="Withholding (2307)" value={money(r.withholdingAmount)} />
          )}
          {!!r.rebateAmount && <Row label="Rebate applied" value={money(r.rebateAmount)} />}
        </Section>

        <Section title="Applied to">
          {grouped ? (
            <div className="space-y-[3px]">
              {r.lines!.map((l, i) => (
                <Row key={i} label={l.accountLine} value={money(l.amount)} />
              ))}
            </div>
          ) : (
            <>
              <Row label="AR Invoice" value={r.invoiceNumber ?? '—'} />
              {r.invoiceAmount != null && (
                <Row label="Invoice Amount" value={money(r.invoiceAmount)} />
              )}
              {/* Rendered only when captured at checkout — an empty "Related
                  DO: —" on every receipt trains people to ignore the line. */}
              {r.relatedDeliveryReceipt && (
                <Row label="Related DO" value={r.relatedDeliveryReceipt} />
              )}
              {r.relatedSalesInvoice && <Row label="Sales Invoice" value={r.relatedSalesInvoice} />}
            </>
          )}
        </Section>

        {/* A combined receipt settles several invoices, each with its own
            running balance, so there is no single summary to state. */}
        {!grouped && r.previousBalance != null && r.remainingBalance != null && (
          <Section title="Account summary">
            {r.invoiceAmount != null && (
              <Row label="Invoice Amount" value={money(r.invoiceAmount)} />
            )}
            <Row label="Previous Balance" value={money(r.previousBalance)} />
            <Row label="Amount Received" value={money(r.amountReceived)} />
            <div className="mt-1 flex justify-between gap-6 border-t border-gray-300 pt-1.5">
              <span className="font-bold text-prominent-purple-900">Remaining Balance</span>
              <span className="text-right font-bold tabular-nums text-prominent-purple-900">
                {money(r.remainingBalance)}
              </span>
            </div>
          </Section>
        )}

        <div className="border-t border-gray-300 pt-3">
          <div className="flex justify-between gap-6">
            <span className="font-bold text-prominent-purple-900">Amount Received</span>
            <span className="text-right text-[15px] font-bold tabular-nums text-prominent-purple-900">
              {money(r.amountReceived)}
            </span>
          </div>
          {r.amountInWords && (
            <p className="mt-1 text-[12px] italic text-gray-600">{r.amountInWords}</p>
          )}
        </div>
      </div>

      {doc.enterprise?.companyLegalName && (
        <p className="mt-6 border-t border-gray-300 pt-3 text-[11px] text-gray-500">
          {doc.enterprise.companyLegalName}
          {doc.enterprise.address ? ` · ${doc.enterprise.address}` : ''}
        </p>
      )}
    </div>
  )
}
