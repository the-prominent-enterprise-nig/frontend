'use client'

import { fmtMoney } from '@/src/libs/data/AccountingV2Data'

/**
 * The AP payment voucher, rendered in place.
 *
 * Deliberately mirrors buildAPPaymentVoucherHtml() in printInventoryDocument.ts
 * — same blocks, same order, same wording — the way this page's Purchase
 * Invoice mirrors buildAPBillHtml(). One renders into a print window, this one
 * renders on the page so the voucher can be read without opening it. They are
 * duplicates on purpose: change one, change the other.
 *
 * The signature and acknowledgment blocks are deliberately absent here. They
 * are lines for a pen, meaningless on screen, and the printed voucher still
 * carries them.
 */

export interface VoucherInvoice {
  billId?: string | null
  billNumber?: string | null
  description?: string | null
  amount?: number | null
}

export interface VoucherSource {
  method?: string | null
  reference?: string | null
  description?: string | null
  amount?: number | null
  bankAccount?: { name?: string | null; accountNumber?: string | null } | null
}

export interface VoucherDocumentEnvelope {
  enterprise?: { companyLegalName?: string | null; address?: string | null } | null
  document: {
    payee?: string | null
    payeeAddress?: string | null
    payeeTin?: string | null
    voucherNumber?: string | null
    paymentDate?: string | null
    voucherDate?: string | null
    method?: string | null
    chequeNumber?: string | null
    reference?: string | null
    description?: string | null
    notes?: string | null
    billNumber?: string | null
    account?: { name?: string | null } | null
    effectiveExpenseAccount?: { name?: string | null } | null
    amount?: number | null
    totalAmount?: number | null
    withholdingAmount?: number | null
    invoices?: VoucherInvoice[]
    sources?: VoucherSource[]
  }
}

// Same cell chrome the Purchase Invoice above uses, so the two documents on
// one page read as the same paper.
const TH = 'border border-gray-300 bg-gray-100 px-2.5 py-[7px] text-left font-bold'
const TD = 'border border-gray-300 px-2.5 py-[7px] align-top'
const TOTAL_LABEL = 'border-b border-gray-100 px-2.5 py-[5px] text-right'
const TOTAL_VALUE = 'border-b border-gray-100 px-2.5 py-[5px] text-right tabular-nums'

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

function prettyMethod(m: unknown): string {
  return (
    String(m ?? '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()) || '—'
  )
}

export default function VoucherDocument({
  envelope,
  /** Makes each invoice row open its bill. Omitted where there is nowhere to
   * go — the document reads the same either way. */
  onOpenInvoice,
}: {
  envelope: VoucherDocumentEnvelope
  onOpenInvoice?: (billId: string) => void
}) {
  const p = envelope.document
  const enterprise = envelope.enterprise
  // Two shapes feed this: a disbursement sends `totalAmount` + `account`, a
  // single payment sends `amount` + `effectiveExpenseAccount`.
  const account = p.effectiveExpenseAccount ?? p.account ?? null

  // What this voucher settled, not what was disbursed — withholding is
  // settled against the invoice but never leaves the bank.
  const amount = Number(p.amount ?? p.totalAmount ?? 0) + Number(p.withholdingAmount ?? 0)
  const withholding = Number(p.withholdingAmount ?? 0)
  const netPaid = amount - withholding

  const reference = p.chequeNumber ? `CK#${p.chequeNumber}` : (p.reference ?? '—')

  const invoices: VoucherInvoice[] = p.invoices?.length
    ? p.invoices
    : [{ billNumber: p.billNumber, description: p.description, amount }]
  const siNumbers = Array.from(new Set(invoices.map((i) => i.billNumber).filter(Boolean)))
  // The SI lives in the header block. It returns as a column only when one
  // cheque settled several invoices, where the header can say which numbers
  // were paid but not how much each got.
  const showInvoiceSi = invoices.length > 1
  // The voucher's OWN description — what the payment form labels Description
  // and stores as notes. The per-invoice column carries each bill's text,
  // which is not the same thing and is usually empty; it earns its place only
  // when one cheque settled several bills and they differ.
  const voucherDescription = p.notes ? String(p.notes) : null
  const showInvoiceDescription = invoices.length > 1

  const sources: VoucherSource[] = p.sources?.length
    ? p.sources
    : p.method
      ? [{ method: p.method, reference: p.chequeNumber ?? p.reference, description: p.description }]
      : []
  // A split cheque is the only case where a source knows something the header
  // cannot already say: its own reference, and its own share of the total.
  const isSplitFunding = sources.length > 1

  return (
    <div className="mt-2.5 rounded-lg border border-gray-200 bg-white px-5 py-6 text-[13px] text-gray-900 sm:px-8 sm:py-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-prominent-purple-900">Payment</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nig-logo.png"
          alt="NIG Marketing"
          className="h-16 w-auto object-contain sm:h-20"
        />
      </div>

      <div className="mt-6 grid gap-7 md:grid-cols-3">
        <div>
          <p className="font-bold text-prominent-purple-900">{p.payee || '—'}</p>
          {p.payeeAddress && <p className="mt-1 text-gray-700">{p.payeeAddress}</p>}
        </div>
        <div className="text-right">
          <MetaPair label="Date" value={docDate(p.paymentDate ?? p.voucherDate)} />
          <MetaPair label="Reference" value={reference} />
          <MetaPair label="VOUCHER #" value={p.voucherNumber || '—'} />
          <MetaPair
            label="SI #"
            value={
              siNumbers.length ? (
                siNumbers.join(', ')
              ) : (
                <span
                  title="Settled before the supplier's invoice number was recorded"
                  className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                >
                  Pending SI
                </span>
              )
            }
          />
          {p.payeeTin && <MetaPair label="PAYEE'S TIN:" value={p.payeeTin} />}
        </div>
        <div className="md:border-l md:border-gray-300 md:pl-7">
          <p className="font-bold text-prominent-purple-900">
            {enterprise?.companyLegalName ?? '—'}
          </p>
          <p className="mt-1 whitespace-pre-line text-gray-700">{enterprise?.address || '—'}</p>
        </div>
      </div>

      {voucherDescription && (
        <p className="mt-7 flex gap-4">
          <span className="w-32 shrink-0 font-bold text-prominent-purple-900">Description</span>
          <span className="text-gray-700">{voucherDescription}</span>
        </p>
      )}

      <div className={`overflow-x-auto ${voucherDescription ? 'mt-3' : 'mt-7'}`}>
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className={TH}>Account</th>
              {showInvoiceSi && <th className={`${TH} w-40`}>SI #</th>}
              {showInvoiceDescription && <th className={TH}>Description</th>}
              <th className={`${TH} w-40 text-right`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, i) => {
              const open =
                onOpenInvoice && inv.billId ? () => onOpenInvoice(inv.billId!) : undefined
              return (
                <tr
                  key={i}
                  onClick={open}
                  className={open ? 'cursor-pointer hover:bg-purple-50/60' : undefined}
                  title={open ? 'Open this invoice' : undefined}
                >
                  <td className={TD}>{account?.name || '—'}</td>
                  {showInvoiceSi && <td className={TD}>{inv.billNumber || '—'}</td>}
                  {showInvoiceDescription && <td className={TD}>{inv.description || '—'}</td>}
                  <td className={`${TD} text-right tabular-nums`}>
                    {fmtMoney(Number(inv.amount ?? 0))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* How it was funded and what it came to are the same beat of the
          document, so they share a row rather than stacking with a band of
          whitespace between them. */}
      <div className="mt-3 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          {sources.length > 0 && (
            <>
              <p className="mb-1.5 font-bold text-prominent-purple-900">Source of Funds</p>
              {sources.map((src, i) => {
                const bank = src.bankAccount
                const bankLabel = bank?.name
                  ? bank.accountNumber
                    ? `${bank.name} — ${bank.accountNumber}`
                    : bank.name
                  : null
                const rows: [string, string][] = [['Method', prettyMethod(src.method)]]
                if (bankLabel) rows.push(['Bank Account', bankLabel])
                if (isSplitFunding && src.reference) rows.push(['Reference', String(src.reference)])
                if (src.description) rows.push(['Description', String(src.description)])
                if (isSplitFunding) rows.push(['Amount', fmtMoney(Number(src.amount ?? 0))])
                return (
                  <div
                    key={i}
                    className={i > 0 ? 'mt-2.5 border-t border-gray-100 pt-2.5' : undefined}
                  >
                    {rows.map(([label, value]) => (
                      <div key={label} className="flex gap-4 py-0.5">
                        <span className="w-32 shrink-0 font-bold text-prominent-purple-900">
                          {label}
                        </span>
                        <span className="text-gray-700">{value}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </>
          )}
        </div>
        <table className="border-collapse self-end text-[13px] sm:self-auto">
          <tbody>
            <tr>
              <td className={TOTAL_LABEL}>Amount paid</td>
              <td className={`${TOTAL_VALUE} min-w-[140px]`}>{fmtMoney(netPaid)}</td>
            </tr>
            {withholding > 0 && (
              <tr>
                <td className={TOTAL_LABEL}>Withholding tax</td>
                <td className={`${TOTAL_VALUE} min-w-[140px]`}>{fmtMoney(withholding)}</td>
              </tr>
            )}
            <tr>
              <td className="border-t border-gray-400 px-2.5 py-[5px] text-right font-bold">
                Total
              </td>
              <td className="border-t border-gray-400 px-2.5 py-[5px] text-right font-bold tabular-nums">
                {fmtMoney(amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
