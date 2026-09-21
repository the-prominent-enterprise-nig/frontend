'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import {
  AcknowledgementReceipts,
  fmtMoney,
  type AcknowledgementReceipt,
} from '@/src/libs/data/AccountingV2Data'
import { printAcknowledgementReceiptDocument } from '@/src/libs/print/printInventoryDocument'

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

function longDate(v: string | null | undefined) {
  return v
    ? new Date(v).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—'
}

function AcknowledgementReceiptDetailBody() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [receipt, setReceipt] = useState<AcknowledgementReceipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
          href="/accounting/ar-invoices/receipts/acknowledgement"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Acknowledgement Receipts
        </Link>
        <p className="text-red-600">{error ?? 'Not found'}</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/accounting/ar-invoices/receipts/acknowledgement"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Acknowledgement Receipts
        </Link>
        <button
          onClick={() => printAcknowledgementReceiptDocument(receipt)}
          className="inline-flex items-center gap-1.5 rounded-md bg-prominent-orange-600 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:bg-prominent-orange-700"
        >
          <Download className="h-4 w-4" />
          Print / Download
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          RECEIVED
        </span>
        <span>Receipt {receipt.number ?? '—'}</span>
        <span>{longDate(receipt.paymentDate)}</span>
        <span>Received {fmtMoney(receipt.amount)}</span>
      </div>

      <div className="mt-2.5 rounded-lg border border-gray-200 bg-white px-5 py-6 text-[13px] text-gray-900 sm:px-8 sm:py-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold uppercase text-prominent-purple-900">
            Acknowledgement Receipt
          </h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nig-logo.png"
            alt="NIG Marketing"
            className="h-16 w-auto object-contain sm:h-20"
          />
        </div>

        <div className="mt-4 space-y-[3px]">
          <Row label="Receipt No." value={receipt.number ?? '—'} />
          <Row label="Date" value={longDate(receipt.paymentDate)} />
        </div>

        <div className="mt-4 space-y-4">
          <div className="border-t border-gray-300 pt-3">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-prominent-purple-900">
              Details
            </p>
            <Row label="Received From" value={receipt.payerName} />
            {receipt.reason && <Row label="Reason" value={receipt.reason} />}
            <Row label="Payment Method" value={receipt.method ?? '—'} />
            <Row label="Reference No." value={receipt.reference || '—'} />
            {receipt.branch?.name && <Row label="Branch" value={receipt.branch.name} />}
          </div>

          <div className="border-t border-gray-300 pt-3">
            <div className="flex justify-between gap-6">
              <span className="font-bold text-prominent-purple-900">Amount Received</span>
              <span className="text-right text-[15px] font-bold tabular-nums text-prominent-purple-900">
                {fmtMoney(receipt.amount)}
              </span>
            </div>
            {receipt.notes && (
              <p className="mt-1 text-[12px] italic text-gray-600">{receipt.notes}</p>
            )}
          </div>
        </div>
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
