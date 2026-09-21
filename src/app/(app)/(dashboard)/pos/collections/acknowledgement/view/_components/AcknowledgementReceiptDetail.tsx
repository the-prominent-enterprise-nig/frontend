'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import {
  AcknowledgementReceipts,
  fmtMoney,
  type AcknowledgementReceipt,
} from '@/src/libs/data/AccountingV2Data'
import { downloadElementAsPdf } from '@/src/libs/print/htmlToPdf'

function accountLabel(account: AcknowledgementReceipt['account']): string {
  if (!account) return 'Miscellaneous Collections'
  return account.number ? `${account.number} — ${account.name}` : account.name
}

function longDate(v: string | null | undefined) {
  return v
    ? new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'
}

function MetaPair({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <p className="font-bold text-prominent-purple-900">{label}</p>
      <p className="mb-3 text-gray-700">{value}</p>
    </>
  )
}

/** The letterhead sheet, matching the client's own real document exactly
 * (developer-shared reference, 2026-09-21): payer/date-reference/enterprise
 * in a 3-column header, the description as a bold title line, a single
 * #/Account/Total row, and two signature blocks (Prepared by / Certified by
 * — no "Approved by," unlike the AP voucher's 3-block signature line).
 * Rendered twice on the page — once as the real Acknowledgement Receipt,
 * once titled "Collection Receipt" below it (developer decision,
 * 2026-09-21: shown on-screen too, not just available as a second print
 * action) — same data both times, just the title differs. */
function ReceiptSheet({ receipt, title }: { receipt: AcknowledgementReceipt; title: string }) {
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
          <p className="font-bold text-prominent-purple-900">{receipt.payerName}</p>
        </div>
        <div className="text-right">
          <MetaPair label="Date" value={longDate(receipt.paymentDate)} />
          <MetaPair label="Reference" value={receipt.reference || receipt.number || '—'} />
        </div>
        <div className="md:border-l md:border-gray-300 md:pl-7">
          <p className="font-bold text-prominent-purple-900">
            {receipt.enterprise?.companyLegalName ?? '—'}
          </p>
          <p className="mt-1 whitespace-pre-line text-gray-700">
            {receipt.enterprise?.address || '—'}
          </p>
        </div>
      </div>

      {receipt.reason && (
        <p className="mb-4 mt-6 font-bold uppercase text-prominent-purple-900">{receipt.reason}</p>
      )}

      <div className={`overflow-x-auto ${receipt.reason ? '' : 'mt-6'}`}>
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="w-9 border border-gray-300 bg-gray-100 px-2.5 py-[7px] text-center font-bold">
                #
              </th>
              <th className="border border-gray-300 bg-gray-100 px-2.5 py-[7px] text-left font-bold">
                Account
              </th>
              <th className="w-40 border border-gray-300 bg-gray-100 px-2.5 py-[7px] text-right font-bold">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 px-2.5 py-[7px] text-center align-top">1</td>
              <td className="border border-gray-300 px-2.5 py-[7px] align-top">
                {accountLabel(receipt.account)} — {receipt.payerName}
              </td>
              <td className="border border-gray-300 px-2.5 py-[7px] text-right align-top tabular-nums">
                {fmtMoney(receipt.amount)}
              </td>
            </tr>
            <tr className="font-bold">
              <td className="border border-gray-300 px-2.5 py-[7px] text-right" colSpan={2}>
                Total
              </td>
              <td className="border border-gray-300 px-2.5 py-[7px] text-right tabular-nums">
                {fmtMoney(receipt.amount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-8">
        <div>
          <p className="font-semibold text-gray-700">Prepared by:</p>
          <div className="mt-8 border-t border-gray-400 pt-1 text-center text-[11px] text-gray-500">
            Name and Signature
          </div>
        </div>
        <div>
          <p className="font-semibold text-gray-700">Certified by:</p>
          <div className="mt-8 border-t border-gray-400 pt-1 text-center text-[11px] text-gray-500">
            Name and Signature
          </div>
        </div>
      </div>
    </div>
  )
}

function AcknowledgementReceiptDetailBody() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [receipt, setReceipt] = useState<AcknowledgementReceipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingAck, setDownloadingAck] = useState(false)
  const [downloadingCr, setDownloadingCr] = useState(false)
  const ackSheetRef = useRef<HTMLDivElement>(null)
  const crSheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!id) {
      setError('No receipt specified.')
      setLoading(false)
      return
    }
    let cancelled = false
    AcknowledgementReceipts.get(id).then((res) => {
      if (cancelled) return
      if (!res.success || !res.data) {
        setError(res.message || res.error || 'Could not load this receipt.')
        setLoading(false)
        return
      }
      setReceipt(res.data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-gray-400 sm:px-6 lg:px-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading receipt…
      </div>
    )
  }

  if (error || !receipt) {
    return (
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href="/pos/collections/acknowledgement"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Acknowledgement Receipts
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  // Real .pdf files, not the print-dialog "Save as PDF" every other document
  // in this app relies on (developer decision, 2026-09-21: "both should
  // download a .pdf file") — captures the already-on-screen sheet below,
  // same downloadElementAsPdf() utility Purchase Orders' own Download button
  // uses.
  const downloadAck = async () => {
    if (!ackSheetRef.current) return
    setDownloadingAck(true)
    try {
      await downloadElementAsPdf(ackSheetRef.current, receipt.number || 'acknowledgement-receipt')
    } finally {
      setDownloadingAck(false)
    }
  }
  const downloadCr = async () => {
    if (!crSheetRef.current) return
    setDownloadingCr(true)
    try {
      await downloadElementAsPdf(
        crSheetRef.current,
        `${receipt.number || 'receipt'}-collection-receipt`
      )
    } finally {
      setDownloadingCr(false)
    }
  }

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/pos/collections/acknowledgement"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Acknowledgement Receipts
        </Link>
        <div className="flex items-center gap-2">
          {/* Scenario 57 — a second, separate document off the same data,
              titled "Collection Receipt" instead. Not a real CollectionReceipt
              row (no customer/invoice here to satisfy that model) and not
              wired into cash reconciliation — developer decision, 2026-09-21:
              "this is manual for a reason." Both buttons download a real
              .pdf (developer decision, same day: "both should download a
              .pdf file") captured from the on-screen sheets below, not the
              print-dialog "Save as PDF" every other document in this app
              relies on. */}
          <button
            onClick={() => void downloadCr()}
            disabled={downloadingCr}
            className="inline-flex items-center gap-1.5 rounded-md border border-prominent-purple-700 px-3 py-1.5 text-[13px] font-semibold text-prominent-purple-700 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloadingCr ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download Collection Receipt
          </button>
          <button
            onClick={() => void downloadAck()}
            disabled={downloadingAck}
            className="inline-flex items-center gap-1.5 rounded-md bg-prominent-orange-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-prominent-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloadingAck ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          RECEIVED
        </span>
        <span>Receipt {receipt.number ?? '—'}</span>
        <span>{longDate(receipt.paymentDate)}</span>
        <span>Received {fmtMoney(receipt.amount)}</span>
      </div>

      <div ref={ackSheetRef} className="mt-2.5">
        <ReceiptSheet receipt={receipt} title="Acknowledgement Receipt" />
      </div>
      <div ref={crSheetRef} className="mt-6">
        <ReceiptSheet receipt={receipt} title="Collection Receipt" />
      </div>
    </div>
  )
}

export default function AcknowledgementReceiptDetail() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 px-4 py-6 text-gray-400 sm:px-6 lg:px-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading receipt…
        </div>
      }
    >
      <AcknowledgementReceiptDetailBody />
    </Suspense>
  )
}
