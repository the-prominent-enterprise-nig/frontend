'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  X,
  Loader2,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
} from 'lucide-react'
import { bulkImportItems } from '../_actions/bulk-import-items'
import { showToast } from '@/src/components/ui/toast'
import { downloadCsv } from '@/src/libs/format/csv-export'
import type { BulkImportItemsResult } from '@/src/schema/inventory/items/bulk-import'

type Props = {
  isOpen: boolean
  onClose: () => void
}

export default function BulkImportItemsModal({ isOpen, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<BulkImportItemsResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  function handleDownloadErrors() {
    if (!result?.errors.length) return
    const filename = `item-import-errors-${Date.now()}.csv`
    // Mirror the original file's own columns (plus an appended error column)
    // when we have them, so failed rows can be reviewed/fixed and re-uploaded
    // directly. Falls back to a plain summary if a row has no raw data for
    // some reason.
    const sample = result.errors.find((e) => e.record)?.record
    if (sample) {
      const columns = Object.keys(sample)
      downloadCsv(
        filename,
        [...columns, 'error'],
        result.errors.map((e) => [...columns.map((c) => e.record?.[c] ?? ''), e.error])
      )
    } else {
      downloadCsv(
        filename,
        ['row', 'sku', 'error'],
        result.errors.map((e) => [e.row, e.sku ?? '', e.error])
      )
    }
  }

  async function handleSubmit() {
    if (!file) {
      showToast({
        title: 'No file selected',
        description: 'Choose a CSV file to import.',
        status: 'error',
      })
      return
    }

    setIsSubmitting(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await bulkImportItems(formData)
    setIsSubmitting(false)

    if (!res.success) {
      showToast({ title: 'Import failed', description: res.message, status: 'error' })
      return
    }

    setResult(res.data ?? null)
    showToast({ title: 'Import complete', description: res.message, status: 'success' })
  }

  function handleClose() {
    setFile(null)
    setResult(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Bulk Import Items</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Create items in bulk from a CSV file.</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          {result ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                  <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-green-600" />
                  <p className="text-2xl font-bold text-green-700">{result.created.length}</p>
                  <p className="text-xs text-green-600">Created</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                  <AlertCircle className="mx-auto mb-1 h-5 w-5 text-red-500" />
                  <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                  <p className="text-xs text-red-500">Errors</p>
                </div>
              </div>

              {!!result.skippedBlankRows && (
                <p className="text-xs text-zinc-400">
                  {result.skippedBlankRows} fully blank row(s) skipped (e.g. trailing commas from an
                  Excel export) — not counted as errors.
                </p>
              )}

              {result.errors.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-500">
                      Row errors
                    </p>
                    <button
                      type="button"
                      onClick={handleDownloadErrors}
                      className="flex items-center gap-1 text-xs font-medium text-prominent-purple-700 hover:text-prominent-purple-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download CSV
                    </button>
                  </div>
                  <ul className="max-h-48 space-y-1 overflow-y-auto">
                    {result.errors.map((e, i) => (
                      <li key={i} className="flex gap-2 text-xs text-red-600">
                        <span className="font-mono text-zinc-400">Row {e.row}</span>
                        {e.sku && <span className="font-mono font-semibold">{e.sku}</span>}
                        <span className="text-red-400">—</span>
                        <span>{e.error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Link
                href="/inventory/stock?tab=serials"
                onClick={handleClose}
                className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 hover:bg-amber-100"
              >
                <span>
                  Have unit-level data (serial numbers, RR, date-in)? That belongs in{' '}
                  <span className="font-semibold">Import Serialized Inventory</span>, under{' '}
                  <span className="font-semibold">Stock → Serial Numbers</span> — this importer only
                  creates catalog items with no stock or serial numbers.
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
                <p className="font-semibold text-zinc-700">Required columns</p>
                <p className="mt-1 font-mono">name</p>
                <p className="mt-2 font-semibold text-zinc-700">Optional columns</p>
                <p className="mt-1 font-mono">
                  sku, baseUnitCode, description, costPrice, sellingPrice, modelNumber, brand, type,
                  category, subcategory
                </p>
                <p className="mt-2 text-zinc-500">
                  <span className="font-medium">sku</span> is auto-generated when left blank.{' '}
                  <span className="font-medium">baseUnitCode</span> defaults to{' '}
                  <span className="font-medium">pcs</span> when left blank, and must otherwise match
                  an existing Unit of Measure code. <span className="font-medium">brand</span>/
                  <span className="font-medium">type</span>/
                  <span className="font-medium">category</span>/
                  <span className="font-medium">subcategory</span> are resolved by name and created
                  automatically if they don&apos;t exist yet (subcategory needs category on the same
                  row). Column headers are matched case-insensitively, and{' '}
                  <span className="font-medium">group</span>/
                  <span className="font-medium">subgroup</span> are accepted as aliases for
                  category/subcategory. Each row is processed independently — a bad row won&apos;t
                  block the rest of the file.
                </p>
              </div>

              {file ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                  <FileText className="h-4 w-4 shrink-0 text-green-600" />
                  <span className="truncate text-sm text-green-700">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="ml-auto shrink-0 text-xs font-medium text-zinc-500 hover:text-zinc-700"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 py-6 text-sm text-zinc-400 hover:border-prominent-purple-300 hover:bg-prominent-purple-50 hover:text-prominent-purple-600"
                >
                  <Upload className="h-4 w-4" />
                  Choose CSV file
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          {result ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setResult(null)
                  setFile(null)
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Import More
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !file}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Importing…' : 'Import Items'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
