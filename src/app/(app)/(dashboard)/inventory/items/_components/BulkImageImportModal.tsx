'use client'

import { useRef, useState } from 'react'
import {
  X,
  Loader2,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  SkipForward,
} from 'lucide-react'
import {
  uploadBulkFile,
  bulkImportImages,
  type BulkImportResult,
} from '../_actions/bulk-import-images'
import { showToast } from '@/src/components/ui/toast'
import type { ItemSummary } from '@/src/schema/inventory/items'

interface MappingRow {
  id: string
  sku: string
  file: File | null
  fileId: string | null
  fileName: string | null
  isUploading: boolean
  uploadError: string | null
}

function newRow(): MappingRow {
  return {
    id: crypto.randomUUID(),
    sku: '',
    file: null,
    fileId: null,
    fileName: null,
    isUploading: false,
    uploadError: null,
  }
}

type Props = {
  isOpen: boolean
  onClose: () => void
  items: ItemSummary[]
}

export default function BulkImageImportModal({ isOpen, onClose, items }: Props) {
  const [rows, setRows] = useState<MappingRow[]>([newRow()])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function setRef(id: string) {
    return (el: HTMLInputElement | null) => {
      fileInputRefs.current[id] = el
    }
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()])
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  function updateSku(id: string, sku: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, sku } : r)))
  }

  async function handleFileSelect(rowId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, file, isUploading: true, uploadError: null } : r))
    )

    const fd = new FormData()
    fd.append('file', file)
    const uploadResult = await uploadBulkFile(fd)

    if (uploadResult.success && uploadResult.data) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                fileId: uploadResult.data!.id,
                fileName: uploadResult.data!.originalName,
                isUploading: false,
                uploadError: null,
              }
            : r
        )
      )
    } else {
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                fileId: null,
                fileName: null,
                isUploading: false,
                uploadError: uploadResult.message ?? 'Upload failed',
              }
            : r
        )
      )
    }

    e.target.value = ''
  }

  async function handleSubmit() {
    const validRows = rows.filter((r) => r.sku.trim() && r.fileId)

    if (validRows.length === 0) {
      showToast({
        title: 'Nothing to import',
        description: 'Each row needs a selected item and an uploaded image.',
        status: 'error',
      })
      return
    }

    setIsSubmitting(true)
    const res = await bulkImportImages(
      validRows.map((r) => ({ sku: r.sku.trim(), fileId: r.fileId! }))
    )
    setIsSubmitting(false)

    if (!res.success) {
      showToast({ title: 'Import failed', description: res.message, status: 'error' })
      return
    }

    setResult(res.data ?? null)
  }

  function handleClose() {
    setRows([newRow()])
    setResult(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Bulk Image Import</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Attach images to items by SKU. Files are uploaded immediately; submit to apply all
              mappings.
            </p>
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
            /* Result summary */
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                  <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-green-600" />
                  <p className="text-2xl font-bold text-green-700">{result.imported}</p>
                  <p className="text-xs text-green-600">Imported</p>
                </div>
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-center">
                  <SkipForward className="mx-auto mb-1 h-5 w-5 text-yellow-600" />
                  <p className="text-2xl font-bold text-yellow-700">{result.skipped.length}</p>
                  <p className="text-xs text-yellow-600">Skipped</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                  <AlertCircle className="mx-auto mb-1 h-5 w-5 text-red-500" />
                  <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                  <p className="text-xs text-red-500">Errors</p>
                </div>
              </div>

              {result.skipped.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Skipped
                  </p>
                  <ul className="space-y-1">
                    {result.skipped.map((s, i) => (
                      <li key={i} className="flex gap-2 text-xs text-zinc-600">
                        <span className="font-mono font-semibold text-zinc-800">{s.sku}</span>
                        <span className="text-zinc-400">—</span>
                        <span>{s.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.errors.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-500">
                    Errors
                  </p>
                  <ul className="space-y-1">
                    {result.errors.map((e, i) => (
                      <li key={i} className="flex gap-2 text-xs text-red-600">
                        <span className="font-mono font-semibold">{e.sku}</span>
                        <span className="text-red-400">—</span>
                        <span>{e.error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* Mapping rows */
            <div className="space-y-3">
              <div className="hidden grid-cols-[1fr_1fr_auto] gap-3 sm:grid">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Item</p>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Image File
                </p>
                <span />
              </div>

              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] items-start gap-3">
                  <div>
                    <select
                      value={row.sku}
                      onChange={(e) => updateSku(row.id, e.target.value)}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
                    >
                      <option value="">Select item…</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.sku}>
                          {item.sku} — {item.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    {row.fileId ? (
                      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                        <span className="truncate text-xs text-green-700">{row.fileName}</span>
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[row.id]?.click()}
                          className="ml-auto shrink-0 text-[10px] font-medium text-zinc-500 hover:text-zinc-700"
                        >
                          Change
                        </button>
                      </div>
                    ) : row.isUploading ? (
                      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                        <span className="text-xs text-zinc-400">Uploading…</span>
                      </div>
                    ) : row.uploadError ? (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                        <span className="truncate text-xs text-red-600">{row.uploadError}</span>
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[row.id]?.click()}
                          className="ml-auto shrink-0 text-[10px] font-medium text-red-600 hover:text-red-800"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRefs.current[row.id]?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-200 py-2 text-xs text-zinc-400 hover:border-prominent-purple-300 hover:bg-prominent-purple-50 hover:text-prominent-purple-600"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload image
                      </button>
                    )}
                    <input
                      ref={setRef(row.id)}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(row.id, e)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length === 1}
                    className="mt-1 rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-30"
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50"
              >
                <Plus className="h-4 w-4" />
                Add row
              </button>
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
                  setRows([newRow()])
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
                disabled={isSubmitting || rows.some((r) => r.isUploading)}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Importing…' : 'Import Images'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
