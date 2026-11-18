'use client'

import { useRef, useState } from 'react'
import { X, Loader2, Upload } from 'lucide-react'
import { bulkImportItems } from '../_actions/bulk-import-items'
import { showToast } from '@/src/components/ui/toast'
import { downloadCsv } from '@/src/libs/format/csv-export'
import type { BulkImportItemsResult } from '@/src/schema/inventory/items/bulk-import'
import { readItemImportPreview, type ItemImportPreview } from '../_lib/item-import-preview'
import { FilePreview, FormatGuide, ImportResult } from './bulk-import-parts'

type Props = {
  isOpen: boolean
  onClose: () => void
  /** Holds price list edit rights — only used to warn up front; the backend
   * decides whether the price columns are saved. */
  canSetPrices?: boolean
}

/** Failed rows in the file's own columns plus an error column, so they can be
 * fixed and re-uploaded as is; a plain summary when no raw row came back. */
function downloadImportErrors(result: BulkImportItemsResult): void {
  const filename = `item-import-errors-${Date.now()}.csv`
  const sample = result.errors.find((e) => e.record)?.record
  if (!sample) {
    downloadCsv(
      filename,
      ['row', 'sku', 'error'],
      result.errors.map((e) => [e.row, e.sku ?? '', e.error])
    )
    return
  }
  const columns = Object.keys(sample)
  downloadCsv(
    filename,
    [...columns, 'error'],
    result.errors.map((e) => [...columns.map((c) => e.record?.[c] ?? ''), e.error])
  )
}

export default function BulkImportItemsModal({
  isOpen,
  onClose,
  canSetPrices,
}: Props): React.JSX.Element | null {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ItemImportPreview | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<BulkImportItemsResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (!selected) return
    setFile(selected)
    setPreview(null)
    try {
      setPreview(await readItemImportPreview(selected))
    } catch {
      showToast({ title: 'Could not read file', description: 'Is it a CSV?', status: 'error' })
      setFile(null)
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!file || !preview) return
    setIsSubmitting(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await bulkImportItems(formData)
    setIsSubmitting(false)
    if (!res.success || !res.data) {
      showToast({ title: 'Upload failed', description: res.message, status: 'error' })
      return
    }
    setResult(res.data)
    showToast({ title: 'Upload complete', description: res.message, status: 'success' })
  }

  function resetFile(): void {
    setFile(null)
    setPreview(null)
    setResult(null)
  }

  function handleClose(): void {
    resetFile()
    onClose()
  }

  if (!isOpen) return null

  const canImport = !!file && !!preview && !preview.problem && !isSubmitting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#eeeef1] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#1d1d26]">Bulk Upload Items</h2>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              Add items, their prices and units on hand from one sheet.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-subtle hover:bg-[#f0e9fc] hover:text-[#5b21b6]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {result ? (
            <ImportResult result={result} onDownloadErrors={() => downloadImportErrors(result)} />
          ) : (
            <div className="space-y-4">
              {file && preview ? (
                <FilePreview
                  fileName={file.name}
                  preview={preview}
                  canSetPrices={canSetPrices}
                  onChange={() => fileInputRef.current?.click()}
                />
              ) : (
                <>
                  <FormatGuide />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#d3d3db] py-6 text-[13px] text-ink-muted hover:border-[#5b21b6] hover:bg-[#f8f5fd] hover:text-[#5b21b6]"
                  >
                    {file ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {file ? 'Reading file…' : 'Choose CSV file'}
                  </button>
                </>
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

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[#eeeef1] px-6 py-4">
          {result ? (
            <>
              <button
                type="button"
                onClick={resetFile}
                className="rounded-lg px-4 py-2 text-sm font-medium text-ink-muted hover:bg-[#f0e9fc]"
              >
                Upload Another
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-[#5b21b6] px-4 py-2 text-sm font-medium text-white hover:bg-[#4c1a9b]"
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
                className="rounded-lg px-4 py-2 text-sm font-medium text-ink-muted hover:bg-[#f0e9fc] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canImport}
                className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-sm font-medium text-white hover:bg-[#4c1a9b] disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting
                  ? 'Uploading…'
                  : preview && !preview.problem
                    ? `Upload ${preview.totalRows} row${preview.totalRows === 1 ? '' : 's'}`
                    : 'Upload'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
