'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Inbox,
  Loader2,
  Pencil,
  Trash2,
  Printer,
  FileText,
} from 'lucide-react'
import {
  APBills,
  apOutstanding,
  fmtMoney,
  type APBillDocument,
} from '@/src/libs/data/AccountingV2Data'
import { discountChainLabel } from '@/src/libs/format/discount-chain'
import {
  printAPBillDocument,
  printAPPaymentVoucherDocument,
} from '@/src/libs/print/printInventoryDocument'
import { getApDisbursementDocument } from '../../_actions/get-ap-disbursement-document'
import { RowActionsMenu, type RowMenuItem } from '@/src/components/ui/RowActionsMenu'

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
  const router = useRouter()
  const [doc, setDoc] = useState<APBillDocument | null>(null)
  // Scenario 46 — the list's per-row action icons moved here. Acting on a bill
  // (Receive especially, which posts a journal entry) should happen where the
  // bill itself is on screen, not from a row you may not have read.
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const res = await APBills.getDocument(id)
    if (res.success && res.data) setDoc(res.data)
  }, [id])

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
  const payments = bill.payments ?? []
  /** Every voucher raised against this invoice, newest first, cancelled ones
   * dropped — a cancelled voucher holds nothing and is not worth listing. */
  const vouchers = (bill.disbursementAllocations ?? []).filter(
    (a) => a.disbursement.status !== 'CANCELLED'
  )
  /** Money already spoken for by a voucher that has not been paid yet. Not the
   * same as paid: amountPaid is untouched and the bill stays RECEIVED, but a
   * further voucher can only claim what is left. */
  const committed = vouchers
    .filter((a) => a.disbursement.status !== 'PAID')
    .reduce((sum, a) => sum + a.amount, 0)

  // Total less the withheld slice (reclassified to the BIR at receive) less
  // cash actually disbursed — matching the deduction lines rendered below.
  // Declared up here because the menu needs it to decide whether raising a
  // voucher is even possible.
  const outstanding = apOutstanding(bill)
  /** What is still free to voucher: the balance less anything already
   * committed to an unpaid voucher. */
  const uncommitted = outstanding - committed

  const printVoucher = async (disbursementId: string) => {
    const res = await getApDisbursementDocument(disbursementId)
    if (res.success && res.data) printAPPaymentVoucherDocument(res.data)
    else alert(res.message || res.error || 'Could not build the voucher')
  }

  // Everything that isn't this bill's headline action. Built from state so a
  // bill never offers something it can't do.
  const menuItems: RowMenuItem[] = [
    ...(bill.status === 'DRAFT'
      ? [
          {
            label: 'Print',
            icon: Printer,
            onClick: () => printAPBillDocument(doc),
          },
        ]
      : []),
    // Raise a voucher for this invoice. Several may be open at once, so the
    // condition is whether anything is left to commit — not whether one exists
    // already. The server applies the same cap.
    ...(['RECEIVED', 'PARTIAL', 'OVERDUE'].includes(bill.status) && uncommitted > 0.005
      ? [
          {
            label: 'Create voucher',
            icon: FileText,
            onClick: () =>
              router.push(
                `/accounting/ap-bills/payments/new?supplier=${bill.supplier?.id ?? ''}&bills=${id}&voucherOnly=1`
              ),
          },
        ]
      : []),
    {
      label: 'Edit',
      icon: Pencil,
      onClick: () => router.push(`/accounting/ap-bills/${id}/edit`),
    },
    {
      label: bill.deletionRequestedAt
        ? 'Deletion already requested'
        : bill.status === 'DRAFT'
          ? 'Delete'
          : 'Request deletion',
      icon: Trash2,
      onClick: () => {
        if (bill.deletionRequestedAt) return
        removeOrRequest()
      },
      variant: 'danger' as const,
    },
  ]

  const receive = async () => {
    // Receiving posts a real journal entry, so say what it will do first —
    // this is the whole reason the action moved off the list row.
    if (
      !confirm(
        `Receive ${bill.billNumber ?? 'this bill'}? This posts a journal entry for ${fmtMoney(bill.totalAmount)}.`
      )
    )
      return
    setBusy(true)
    const res = await APBills.receive(id)
    setBusy(false)
    if (!res.success)
      alert(res.message || res.error || 'Receive failed — check Account Mapping settings')
    reload()
  }

  const removeOrRequest = async () => {
    if (bill.status === 'DRAFT') {
      if (!confirm('Delete this bill?')) return
      setBusy(true)
      const res = await APBills.remove(id)
      setBusy(false)
      if (!res.success) return alert(res.message || res.error || 'Delete failed')
      return router.push('/accounting/ap-bills')
    }
    const reason = prompt(
      `This bill is ${bill.status} and can't be deleted directly.\nGive a reason and it will be sent for approval:`
    )
    if (!reason?.trim()) return
    setBusy(true)
    const res = await APBills.requestDeletion(id, reason.trim())
    setBusy(false)
    if (!res.success) alert(res.message || res.error || 'Could not request deletion')
    else alert('Deletion requested — it needs approval before the bill is removed.')
    reload()
  }
  const enterprise = doc.enterprise
  const goodsReceipts = bill.goodsReceipts ?? []
  const debitMemos = bill.debitMemos ?? []
  const withholding = bill.withholdingAmount ?? 0
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
        {/* Scenario 46 — the list's per-row action icons live here now. One
            filled button for the action this bill's state actually calls for,
            everything else behind the overflow menu: four differently-coloured
            buttons in a row read as decoration rather than hierarchy. */}
        <div className="flex items-center gap-2">
          {bill.status === 'DRAFT' ? (
            <button
              onClick={receive}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-prominent-orange-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:opacity-50"
            >
              <Inbox className="h-4 w-4" /> Receive
            </button>
          ) : (
            <button
              onClick={() => printAPBillDocument(doc)}
              className="inline-flex items-center gap-1.5 rounded-md bg-prominent-orange-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-prominent-orange-700"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
          )}
          <RowActionsMenu items={menuItems} />
        </div>
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
        {/* The voucher belongs to the payment that settled this invoice, not to
            the invoice — bill.voucherNumber is the retired approve-then-pay
            field and nothing writes it any more, so this showed nothing for
            every payment made since Scenario 46. */}
        {!vouchers.length && bill.voucherNumber && (
          <span>
            Voucher {bill.voucherNumber}
            {bill.voucherApprovalStatus &&
              ` · ${VOUCHER_STATUS_LABEL[bill.voucherApprovalStatus] ?? bill.voucherApprovalStatus}`}
          </span>
        )}
        {bill.description && <span>{bill.description}</span>}
      </div>

      {/* Every voucher raised against this invoice, in its own panel rather
          than a badge in the strip above. An invoice can carry several at once
          — part of the balance on one, part on another — so a single line
          could only ever name one of them, and the amounts are the point:
          what is committed, and what is still free to voucher. */}
      {vouchers.length > 0 && (
        <section className="mt-2.5 rounded-lg border border-gray-200 bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-5 py-2.5">
            <h2 className="text-[13px] font-semibold text-prominent-purple-900">
              {vouchers.length === 1 ? 'Voucher' : `Vouchers (${vouchers.length})`}
            </h2>
            <span className="text-[12px] text-gray-500">
              {fmtMoney(committed)} committed
              {uncommitted > 0.005 && (
                <>
                  {' · '}
                  <span className="text-amber-700">{fmtMoney(uncommitted)} not yet vouchered</span>
                </>
              )}
            </span>
          </div>
          <ul className="divide-y divide-gray-100">
            {vouchers.map((a) => {
              const d = a.disbursement
              const unpaid = d.status === 'UNPAID'
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-[13px]"
                >
                  <span className="font-mono text-xs font-semibold text-prominent-purple-900">
                    {d.voucherNumber ?? '—'}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      unpaid ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {unpaid ? 'Unpaid' : 'Paid'}
                  </span>
                  <span className="text-gray-500">
                    {unpaid
                      ? `Raised ${docDate(d.voucherDate)}`
                      : `Paid ${docDate(d.paymentDate ?? d.voucherDate)}`}
                  </span>
                  <span className="ml-auto font-semibold tabular-nums text-gray-900">
                    {fmtMoney(a.amount)}
                  </span>
                  <span className="flex items-center gap-1">
                    <button
                      onClick={() => printVoucher(d.id)}
                      title="Print voucher"
                      aria-label={`Print voucher ${d.voucherNumber ?? ''}`}
                      className="rounded p-1.5 text-sky-600 hover:bg-sky-50"
                    >
                      <Printer className="h-4 w-4" />
                    </button>
                    {/* Only while it is unpaid. Once the cheque is cut the
                        voucher has posted to the GL and amending it would put
                        the paper and the ledger out of step — the server
                        refuses it too. */}
                    {unpaid && (
                      <button
                        onClick={() =>
                          router.push(`/accounting/ap-bills/payments/new?edit=${d.id}`)
                        }
                        title="Edit voucher"
                        aria-label={`Edit voucher ${d.voucherNumber ?? ''}`}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {unpaid && (
                      <button
                        onClick={() =>
                          router.push(`/accounting/ap-bills/payments/new?settle=${d.id}`)
                        }
                        className="rounded-md bg-emerald-700 px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-emerald-800"
                      >
                        Pay
                      </button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

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
              value={
                bill.billNumber ?? (
                  <span
                    title="Received without the supplier's invoice number — still payable"
                    className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"
                  >
                    Pending SI
                  </span>
                )
              }
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
                      {/* Why the unit price is what it is. The invoice states a
                          cost; the chain behind it is what an approver checks
                          the supplier's terms against. Absent on receipts taken
                          before the pricing fields reached the server, which
                          simply render nothing extra. */}
                      {discountChainLabel(l, fmtMoney) && (
                        <div className="mt-0.5 text-[11px] text-gray-500">
                          {discountChainLabel(l, fmtMoney)}
                        </div>
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
                  it is reclassified to WHT Payable instead — so it sits below
                  with the payments, where it reaches Balance due. It is not a
                  payment and never enters amountPaid. */}
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
              {/* Debit memos sit with the payments rather than above Total:
                  like withholding, they never reduced totalAmount — they
                  reduce what is left to settle. Without them the document
                  shows a Total and a Balance due that don't reconcile. */}
              {debitMemos.map((m) => (
                <tr key={m.id}>
                  <td className={TOTAL_LABEL}>
                    Debit memo — {m.memoNumber}
                    {m.reason ? ` — ${m.reason}` : ''} — {docDate(m.memoDate)}
                  </td>
                  <td className={`${TOTAL_VALUE} min-w-[140px]`}>- {fmtMoney(m.amount)}</td>
                </tr>
              ))}
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
