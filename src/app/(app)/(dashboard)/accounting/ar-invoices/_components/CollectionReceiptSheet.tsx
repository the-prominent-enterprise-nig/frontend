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
}

export default function CollectionReceiptSheet({
  customer,
  enterprise,
  date,
  reference,
  description,
  rows,
  total,
}: CollectionReceiptSheetProps) {
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
                Total
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
 * /ar-invoices/:id/payments/:paymentId/document). `lines` is only present on
 * a receipt ARInvoicesList combined from several applications — a
 * single-application receipt falls back to its own invoice line. */
export interface CollectionReceiptDocument {
  documentType: string
  documentNumber: string
  generatedAt: string
  enterprise?: { companyLegalName?: string | null; address?: string | null } | null
  document: {
    paymentDate: string
    reference: string | null
    amount: number
    description?: string | null
    invoiceNumber?: string
    customer: { name: string; address: string | null; taxId: string | null }
    lines?: { accountLine: string; amount: number }[]
  }
}

/** The same sheet, fed straight from the print envelope — so the inline
 * preview and printCollectionReceiptDocument() render the same document. */
export function CollectionReceiptDocumentSheet({ doc }: { doc: CollectionReceiptDocument }) {
  const r = doc.document
  const rows =
    r.lines && r.lines.length > 0
      ? r.lines
      : [
          {
            accountLine: `Accounts Receivable — ${r.customer?.name ?? '—'} — ${r.invoiceNumber ?? '—'}`,
            amount: r.amount,
          },
        ]
  return (
    <CollectionReceiptSheet
      customer={r.customer}
      enterprise={doc.enterprise}
      date={r.paymentDate}
      reference={r.reference || doc.documentNumber}
      description={r.description}
      rows={rows}
      total={r.amount}
    />
  )
}
