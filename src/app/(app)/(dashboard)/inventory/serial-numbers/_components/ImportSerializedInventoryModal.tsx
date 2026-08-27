'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Upload, CheckCircle2, AlertCircle, FileText, Download } from 'lucide-react'
import { bulkImportSerials } from '../_actions/bulk-import-serials'
import { showToast } from '@/src/components/ui/toast'
import { downloadCsv } from '@/src/libs/format/csv-export'
import type { SerializedImportResult } from '@/src/schema/inventory/serial-numbers/bulk-import'

type WarehouseOption = {
  id: string
  name: string
  code: string
  branch?: { id: string; name: string } | null
}

type Props = {
  isOpen: boolean
  onClose: () => void
  warehouses: WarehouseOption[]
}

const fieldClass =
  'w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500'

export default function ImportSerializedInventoryModal({ isOpen, onClose, warehouses }: Props) {
  const queryClient = useQueryClient()
  const [warehouseId, setWarehouseId] = useState('')
  const [validateOnly, setValidateOnly] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<SerializedImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  function handleDownloadErrors() {
    if (!result?.errors.length) return
    const filename = `serialized-import-errors-${Date.now()}.csv`
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
        ['row', 'field', 'value', 'error'],
        result.errors.map((e) => [e.row, e.field ?? '', e.value ?? '', e.error])
      )
    }
  }

  async function handleSubmit() {
    if (!warehouseId) {
      showToast({
        title: 'No warehouse selected',
        description: 'Choose which warehouse receives this stock.',
        status: 'error',
      })
      return
    }
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
    formData.append('warehouseId', warehouseId)
    formData.append('dryRun', String(validateOnly))
    const res = await bulkImportSerials(formData)
    setIsSubmitting(false)

    if (!res.success) {
      showToast({ title: 'Import failed', description: res.message, status: 'error' })
      return
    }

    setResult(res.data ?? null)
    showToast({
      title: validateOnly ? 'Preview ready' : 'Import complete',
      description: res.message,
      status: 'success',
    })

    if (!validateOnly && res.data && res.data.created > 0) {
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-serial-numbers'] })
      // group/subgroup columns resolve onto Category — a new brand/type/
      // category can get created mid-import, so the Catalog's Categories
      // tab needs to refetch too, not just Items/Serials.
      queryClient.invalidateQueries({ queryKey: ['inventory-categories-flat'] })
    }
  }

  function handleClose() {
    setFile(null)
    setResult(null)
    setValidateOnly(true)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Import Serialized Inventory</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Backfill historical serialized stock (e.g. an existing spreadsheet) from a CSV file.
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                  <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-green-600" />
                  <p className="text-2xl font-bold text-green-700">{result.created}</p>
                  <p className="text-xs text-green-600">
                    {result.dryRun ? 'Importable' : 'Created'}
                  </p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                  <AlertCircle className="mx-auto mb-1 h-5 w-5 text-red-500" />
                  <p className="text-2xl font-bold text-red-600">{result.errors.length}</p>
                  <p className="text-xs text-red-500">Errors</p>
                </div>
              </div>

              {result.dryRun && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  This was a preview — nothing was written. Uncheck &ldquo;Preview only&rdquo; and
                  import again to actually create these rows.
                </p>
              )}

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
                        {e.value && <span className="font-mono font-semibold">{e.value}</span>}
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
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
                <p className="font-semibold text-zinc-700">Required columns</p>
                <p className="mt-1 font-mono">
                  dateIn, rr, brand, type, group, subgroup, model, serialNumber, price
                </p>
                <p className="mt-2 font-semibold text-zinc-700">Optional columns</p>
                <p className="mt-1 font-mono">origin, description</p>
                <p className="mt-2 text-zinc-500">
                  Rows sharing an <span className="font-medium">rr</span> are grouped into one
                  receiving report. <span className="font-medium">group</span>/
                  <span className="font-medium">subgroup</span> resolve onto Category — unknown
                  brand/type/category names are created automatically.{' '}
                  <span className="font-medium">price</span> is recorded as the item&apos;s cost
                  price. Column headers are matched case-insensitively, and{' '}
                  <span className="font-medium">serial</span> is accepted as an alias for
                  serialNumber.
                </p>
              </div>

              <div>
                <label
                  htmlFor="import-serialized-warehouse"
                  className="mb-1 block text-sm font-medium text-zinc-700"
                >
                  Location <span className="text-red-500">*</span>
                </label>
                <select
                  id="import-serialized-warehouse"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className={`${fieldClass} bg-white`}
                >
                  <option value="">Select location…</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.branch?.name ?? wh.name}
                    </option>
                  ))}
                </select>
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

              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={validateOnly}
                  onChange={(e) => setValidateOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-prominent-purple-700 focus:ring-prominent-purple-500"
                />
                Preview only (validate without writing anything)
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 px-6 py-4">
          {result ? (
            <>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                {result.dryRun ? 'Back' : 'Import More'}
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
                disabled={isSubmitting || !file || !warehouseId}
                className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Importing…' : validateOnly ? 'Preview Import' : 'Import Stock'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
