'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { BankAccounts, type BankReconciliation } from '@/src/libs/data/AccountingV2Data'
import { downloadElementAsPdf } from '@/src/libs/print/htmlToPdf'
import { BankLedgerView, BankReconciliationSheet } from './ReconciliationWorksheet'

// Full pages for what used to open as modals over the worksheet (client
// UI/UX direction, 2026-09-30): the Discrepancy drill-down and the printable
// reconciliation.

function useReconciliation(id: string) {
  const [rec, setRec] = useState<BankReconciliation | null | undefined>(undefined)
  useEffect(() => {
    BankAccounts.getReconciliationWorksheet(id).then((r) =>
      setRec(r.success && r.data ? r.data : null)
    )
  }, [id])
  return rec
}

function Loading({ rec }: { rec: BankReconciliation | null | undefined }) {
  return (
    <div className="p-10 text-sm text-gray-400">
      {rec === undefined ? 'Loading...' : 'Reconciliation not found.'}
    </div>
  )
}

export function ReconciliationTransactionsPage({ id }: { id: string }) {
  const rec = useReconciliation(id)
  if (!rec) return <Loading rec={rec} />
  return (
    <BankLedgerView
      reconciliationId={id}
      bankName={rec.bankAccount?.name ?? 'this bank'}
      statementDate={rec.statementDate}
    />
  )
}

export function ReconciliationPrintPage({ id }: { id: string }) {
  const rec = useReconciliation(id)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  // A real .pdf file on disk, captured from the sheet already on screen —
  // same downloadElementAsPdf() the worksheet's old preview used.
  const downloadPdf = async () => {
    if (!rec || !sheetRef.current) return
    setDownloading(true)
    try {
      await downloadElementAsPdf(
        sheetRef.current,
        `bank-reconciliation-${rec.bankAccount?.name ?? 'account'}-${String(rec.statementDate).slice(0, 10)}`
      )
    } finally {
      setDownloading(false)
    }
  }

  if (!rec) return <Loading rec={rec} />
  return (
    <div className="px-6 py-8 lg:px-10 max-w-4xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/accounting/bank-reconciliation/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to worksheet
        </Link>
        <button
          onClick={() => void downloadPdf()}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {downloading ? 'Preparing PDF...' : 'Download PDF'}
        </button>
      </div>
      <div ref={sheetRef}>
        <BankReconciliationSheet rec={rec} />
      </div>
    </div>
  )
}
