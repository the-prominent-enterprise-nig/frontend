'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Download, Loader2 } from 'lucide-react'
import { APBills, fmtMoney, type APBillDocument } from '@/src/libs/data/AccountingV2Data'
import { printAPBillDocument } from '@/src/libs/print/printInventoryDocument'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  RECEIVED: 'bg-blue-50 text-blue-700',
  PARTIAL: 'bg-amber-50 text-amber-700',
  OVERDUE: 'bg-red-50 text-red-700',
  PAID: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

const VOUCHER_STATUS_LABEL: Record<string, string> = {
  pending_online_approval: 'Pending online approval',
  pending_onsite_approval: 'Pending on-site approval',
  approved: 'Approved',
  rejected: 'Rejected',
  voided: 'Voided',
}

// Same cell chrome as buildAPBillHtml()'s `th, td { border: 1px solid #ccc }`
// so the on-screen document and the printed one read as the same paper.
const TH = 'border border-gray-300 bg-gray-100 px-2.5 py-[7px] text-left font-bold'
const TD = 'border border-gray-300 px-2.5 py-[7px] align-top'
// Totals block — borderless rows with a hairline rule, right-aligned.
const TOTAL_LABEL = 'border-b border-gray-100 px-2.5 py-[5px] text-right'
const TOTAL_VALUE = 'border-b border-gray-100 px-2.5 py-[5px] text-right tabular-nums'

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

export default function APBillDetail({ id }: { id: string }) {
  const [doc, setDoc] = useState<APBillDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // The document envelope is a superset of GET /ap-bills/:id — it adds the
    // enterprise letterhead block and the server-resolved expense account —
    // so one fetch backs both this view and the Print button.
    APBills.getDocument(id).then((res) => {
      if (res.success && res.data) setDoc(res.data)
      else setError(res.error ?? 'Bill not found')
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-gray-400 sm:px-6 lg:px-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading bill…
      </div>
    )
  }

  if (error || !doc) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href="/accounting/ap-bills"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to AP Invoices
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  const bill = doc.document
  const enterprise = doc.enterprise
  const goodsReceipts = bill.goodsReceipts ?? []
  const payments = bill.payments ?? []
  const withholding = bill.withholdingAmount ?? 0
  const outstanding = bill.totalAmount - bill.amountPaid

  const rrCodes = Array.from(new Set(goodsReceipts.map((r) => r.code).filter(Boolean)))
  const siNumbers = Array.from(
    new Set(goodsReceipts.map((r) => r.supplierInvoiceNumber).filter(Boolean))
  ) as string[]
  const drNumbers = Array.from(
    new Set(goodsReceipts.map((r) => r.deliveryReceiptNumber).filter(Boolean))
  ) as string[]
  const lines = goodsReceipts.flatMap((r) => r.lines ?? [])

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/accounting/ap-bills"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to AP Invoices
        </Link>
        <button
          onClick={() => printAPBillDocument(doc)}
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
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[bill.status] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {bill.status === 'PAID' && <CheckCircle2 className="h-3 w-3" />}
          {bill.status}
        </span>
        {drNumbers.length > 0 && <span>DR# {drNumbers.join(', ')}</span>}
        {siNumbers.length > 0 && <span>Receipt SI {siNumbers.join(', ')}</span>}
        {bill.voucherNumber && (
          <span>
            Voucher {bill.voucherNumber}
            {bill.voucherApprovalStatus &&
              ` · ${VOUCHER_STATUS_LABEL[bill.voucherApprovalStatus] ?? bill.voucherApprovalStatus}`}
          </span>
        )}
        {bill.description && <span>{bill.description}</span>}
      </div>

      <div className="mt-2.5 rounded-lg border border-gray-200 bg-white px-5 py-6 text-[13px] text-gray-900 sm:px-8 sm:py-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-prominent-purple-900">Purchase Invoice</h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nig-logo.png"
            alt="NIG Marketing"
            className="h-16 w-auto object-contain sm:h-20"
          />
        </div>

        <div className="mt-6 grid gap-7 md:grid-cols-3">
          <div>
            <p className="font-bold text-prominent-purple-900">{bill.supplier?.name ?? '—'}</p>
            <p className="mt-1 text-gray-700">{bill.supplier?.address || '—'}</p>
          </div>
          <div className="text-right">
            <MetaPair label="Invoice date" value={docDate(bill.billDate)} />
            <MetaPair label="Due date" value={docDate(bill.dueDate)} />
            <MetaPair
              label="SI number"
              value={bill.billNumber ?? <span className="italic text-gray-400">Pending SI #</span>}
            />
            {bill.purchaseOrder && (
              <MetaPair label="Order number" value={bill.purchaseOrder.code} />
            )}
            <MetaPair label="PAYEE'S TIN:" value={bill.supplier?.taxId || '—'} />
          </div>
          <div className="md:border-l md:border-gray-300 md:pl-7">
            <p className="font-bold text-prominent-purple-900">
              {enterprise?.companyLegalName ?? '—'}
            </p>
            <p className="mt-1 whitespace-pre-line text-gray-700">{enterprise?.address || '—'}</p>
          </div>
        </div>

        {rrCodes.length > 0 && (
          <p className="mb-3 mt-7 font-bold text-prominent-purple-900">RR# {rrCodes.join(', ')}</p>
        )}

        <div className="overflow-x-auto">
          {lines.length > 0 ? (
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className={TH}>Item</th>
                  <th className={`${TH} w-24 text-right`}>Qty</th>
                  <th className={`${TH} w-36 text-right`}>Unit price</th>
                  <th className={`${TH} w-40 text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className={TD}>
                      {l.item?.name ?? '—'}
                      {l.isFreebie && (
                        <span className="ml-1.5 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                          Freebie
                        </span>
                      )}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{l.quantityReceived}</td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {l.unitCost != null ? fmtMoney(l.unitCost) : '—'}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {fmtMoney((l.quantityReceived ?? 0) * (l.unitCost ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className={TH}>Account</th>
                  <th className={`${TH} w-40 text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD}>{bill.effectiveExpenseAccount?.name ?? '—'}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmtMoney(bill.totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-3 flex justify-end">
          <table className="text-[12.5px]">
            <tbody>
              <tr>
                <td className={TOTAL_LABEL}>Sub-total</td>
                <td className={`${TOTAL_VALUE} min-w-[140px]`}>{fmtMoney(bill.subtotal)}</td>
              </tr>
              <tr>
                <td className={TOTAL_LABEL}>Input VAT</td>
                <td className={`${TOTAL_VALUE} min-w-[140px]`}>{fmtMoney(bill.taxAmount)}</td>
              </tr>
              {/* Total is VAT-exclusive (subtotal + taxAmount), so VAT is an
                  addend above it; withholding never reduced totalAmount —
                  receive() counts it into amountPaid — so it sits below with
                  the payments, where it actually reaches Balance due. */}
              <tr className="font-bold">
                <td className="border-t border-gray-400 px-2.5 py-[5px] text-right">Total</td>
                <td className="min-w-[140px] border-t border-gray-400 px-2.5 py-[5px] text-right tabular-nums">
                  {fmtMoney(bill.totalAmount)}
                </td>
              </tr>
              {withholding > 0 && (
                <tr>
                  <td className={TOTAL_LABEL}>Withholding tax</td>
                  <td className={`${TOTAL_VALUE} min-w-[140px]`}>- {fmtMoney(withholding)}</td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className={TOTAL_LABEL}>
                    Payment
                    {p.chequeNumber || p.reference
                      ? ` — CK#${p.chequeNumber || p.reference}`
                      : ''}{' '}
                    — {docDate(p.paymentDate)}
                  </td>
                  <td className={`${TOTAL_VALUE} min-w-[140px]`}>- {fmtMoney(p.amount)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border-y-2 border-gray-700 px-2.5 py-[5px] text-right">
                  Balance due
                </td>
                <td className="min-w-[140px] border-y-2 border-gray-700 px-2.5 py-[5px] text-right tabular-nums">
                  {fmtMoney(outstanding)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
