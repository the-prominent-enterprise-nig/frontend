'use client'

import { useMemo, useRef } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react'
import {
  isNetMismatchRow,
  type AcknowledgementImportPreview,
} from '@/src/schema/pos/acknowledgement-import'
import { useReceiptsImport } from '../_hooks/useReceiptsImport'
import { useImportLookups } from '../_hooks/useImportLookups'
import { downloadReceiptImportTemplate } from '../_lib/upload-template'
import PreviewTable from './PreviewTable'

function ChooseStep({
  file,
  busy,
  onFile,
}: {
  file: File | null
  busy: boolean
  onFile: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-prominent-purple-900">1. Choose your CSV</h2>
        <p className="mt-1 text-sm text-gray-500">
          Export your sheet as CSV (File → Download → Comma-separated values). You will see every
          row — and what would be posted — before anything is saved. Delete the two example rows
          from the template first.
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white py-10 text-sm text-gray-500 hover:border-purple-700 hover:bg-purple-50 hover:text-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? 'Reading your file…' : file ? 'Choose a different file' : 'Choose CSV file'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,text/csv"
        className="hidden"
        data-testid="receipts-import-input"
        onChange={(e) => {
          const picked = e.target.files?.[0]
          // Reset so choosing the same file again (after fixing it) re-triggers.
          e.target.value = ''
          if (picked) onFile(picked)
        }}
      />

      {file && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <FileText className="h-4 w-4 shrink-0 text-emerald-700" />
          <span className="truncate text-sm text-emerald-800">{file.name}</span>
          <span className="ml-auto shrink-0 text-xs text-gray-500">
            {(file.size / 1024).toFixed(1)} KB
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={downloadReceiptImportTemplate}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-700 hover:text-purple-900"
      >
        <Download className="h-4 w-4" />
        Download CSV template
      </button>
    </section>
  )
}

/** How many rows, and how many of them are fine, need a look, or are blocked —
 * three small counts, each in its own status colour (grey when it is zero). */
function SummaryLine({ summary }: { summary: AcknowledgementImportPreview['summary'] }) {
  const counts = [
    { label: 'OK', value: summary.ok, dot: 'bg-emerald-500', text: 'text-emerald-700' },
    {
      label: summary.warnings === 1 ? 'warning' : 'warnings',
      value: summary.warnings,
      dot: 'bg-amber-500',
      text: 'text-amber-700',
    },
    {
      label: summary.errors === 1 ? 'error' : 'errors',
      value: summary.errors,
      dot: 'bg-red-500',
      text: 'text-red-700',
    },
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="font-semibold text-gray-900">
        {summary.total} {summary.total === 1 ? 'row' : 'rows'}
      </span>
      {counts.map((c) => (
        <span
          key={c.label}
          className={`inline-flex items-center gap-1.5 ${c.value ? c.text : 'text-gray-400'}`}
        >
          <span aria-hidden className={`h-2 w-2 rounded-full ${c.value ? c.dot : 'bg-gray-300'}`} />
          <span className="font-semibold tabular-nums">{c.value}</span> {c.label}
        </span>
      ))}
    </div>
  )
}

export default function ImportReceiptsView() {
  const imp = useReceiptsImport()
  const lookups = useImportLookups()
  const { phase, preview } = imp

  const rows = preview?.rows ?? []
  const editable = useMemo(() => new Map(imp.rows.map((r) => [r.rowNumber, r])), [imp.rows])
  const netMismatchRows = rows.filter(isNetMismatchRow)
  const blocked = !!preview?.blockingErrors
  // Confirm waits for the re-check: until it lands, the statuses on screen
  // describe the rows as they were before the last edit.
  const canImport = !!preview && preview.summary.total > 0 && !blocked && !imp.checking
  const importedCount = imp.result?.imported ?? imp.result?.created ?? preview?.summary.total ?? 0

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/pos/collections/acknowledgement"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Receipts
      </Link>

      <h1 className="text-2xl font-semibold text-prominent-purple-900">Import receipts</h1>
      <p className="mt-1 text-sm text-gray-500">
        Upload many receipts at once, including ones dated in the past. Every row is checked first,
        and you can fix any of them on the review screen before importing. The import posts all of
        them or none.
      </p>

      <div className="mt-6 space-y-6">
        {(phase === 'choose' || phase === 'previewing') && (
          <ChooseStep file={imp.file} busy={phase === 'previewing'} onFile={imp.choose} />
        )}

        {(phase === 'review' || phase === 'applying') && preview && (
          // @container: the table and the edit panels below size themselves by
          // THIS section's width (the page's content area, which the app
          // sidebar narrows), not by the browser window's.
          <section className="@container space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5">
                <h2 className="text-base font-semibold text-prominent-purple-900">
                  2. Review {imp.file?.name}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <SummaryLine summary={preview.summary} />
                  {imp.checking && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Loader2 className="h-3 w-3 animate-spin" /> Checking…
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={imp.reset}
                disabled={phase === 'applying'}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Choose a different file
              </button>
            </div>

            {blocked && (
              <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  {preview.summary.errors} {preview.summary.errors === 1 ? 'row has' : 'rows have'}{' '}
                  errors, so nothing can be imported yet. Open the row with Edit to fix it, or
                  Remove it from the import — nothing has been saved.
                </p>
              </div>
            )}

            {netMismatchRows.length > 0 && (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    <span className="font-semibold">
                      {netMismatchRows.length}{' '}
                      {netMismatchRows.length === 1 ? 'row has' : 'rows have'} a Net Amount that
                      differs from the calculated one
                    </span>{' '}
                    (Gross − Subsidy + Withholding Tax). You can still import: the entry has to
                    balance, so the calculated Net is the one that posts. Fix the rows (Edit) if the
                    file&apos;s Net is the one that is right.
                  </p>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {rows.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">
                  No rows left to import.
                </p>
              ) : (
                <PreviewTable
                  rows={rows}
                  editable={editable}
                  expanded={imp.expanded}
                  checking={imp.checking}
                  disabled={phase === 'applying'}
                  lookups={lookups}
                  onToggle={imp.toggleExpanded}
                  onRemove={imp.removeRow}
                  onCellsChange={imp.updateCells}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
              <p className="text-sm text-gray-600">
                <span className="font-semibold tabular-nums text-gray-900">
                  {preview.summary.total}
                </span>{' '}
                {preview.summary.total === 1 ? 'receipt' : 'receipts'} will be imported — all or
                none.
              </p>
              <button
                type="button"
                onClick={() => void imp.apply()}
                disabled={!canImport || phase === 'applying'}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {phase === 'applying' && <Loader2 className="h-4 w-4 animate-spin" />}
                {phase === 'applying'
                  ? 'Importing…'
                  : `Import ${preview.summary.total} ${preview.summary.total === 1 ? 'receipt' : 'receipts'}`}
              </button>
            </div>
          </section>
        )}

        {phase === 'done' && (
          <section className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              <div className="text-sm text-emerald-900">
                <p className="font-semibold">
                  Imported {importedCount} {importedCount === 1 ? 'receipt' : 'receipts'}.
                </p>
                {!!imp.result?.customersCreated && (
                  <p className="mt-0.5">
                    {imp.result.customersCreated} new{' '}
                    {imp.result.customersCreated === 1 ? 'customer was' : 'customers were'} added.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/pos/collections/acknowledgement"
                className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
              >
                View receipts
              </Link>
              <Link
                href="/pos/collections"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Back to Collections
              </Link>
              <button
                type="button"
                onClick={imp.reset}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Import another file
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
