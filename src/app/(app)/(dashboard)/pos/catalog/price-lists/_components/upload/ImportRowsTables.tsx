'use client'

import { Download } from 'lucide-react'
import { MONO } from '@/src/libs/design/plex'
import { SKIPPED_STATUS_LABELS, downloadSkippedRows } from '../../_lib/upload-template'
import type { PriceListImportRow } from '@/src/schema/inventory/price-lists/import'

const CHANGES_PREVIEW_LIMIT = 100

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })
const money = (n: number | null | undefined) => (n == null ? '—' : peso.format(n))

export function SkippedRowsTable({ rows }: { rows: PriceListImportRow[] }) {
  if (rows.length === 0) return null
  return (
    <section className="rounded-xl border border-[#f5e2c6] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f5e2c6] bg-[#fdf3e7] px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-prominent-purple-900">
            {rows.length.toLocaleString()} skipped row{rows.length === 1 ? '' : 's'}
          </h3>
          <p className="text-xs text-[#8a4b06]">
            These won’t be uploaded. Fix them in your sheet and upload again, or ignore them.
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadSkippedRows(rows)}
          className="flex items-center gap-1.5 text-xs font-medium text-[#5b21b6] hover:text-[#3f1490]"
        >
          <Download className="h-3.5 w-3.5" />
          Download skipped rows
        </button>
      </div>
      <div className="max-h-[26rem] overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wide text-[#5b5b6b]">
            <tr className="border-b border-[#eeeef1]">
              <th className="px-4 py-2 font-semibold">Row</th>
              <th className="px-4 py-2 font-semibold">Brand</th>
              <th className="px-4 py-2 font-semibold">Model</th>
              <th className="px-4 py-2 font-semibold">Why</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.row} className="border-b border-[#f4f4f6] last:border-0">
                <td className={`${MONO} px-4 py-2 text-xs text-[#8b8b9b]`}>{r.row}</td>
                <td className="px-4 py-2">{r.brand || '—'}</td>
                <td className={`${MONO} px-4 py-2 text-xs`}>{r.model || '—'}</td>
                <td className="px-4 py-2">
                  <span className="mr-2 inline-flex rounded-md bg-[#fbeed8] px-2 py-0.5 text-[11px] font-medium text-[#8a4b06]">
                    {SKIPPED_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  <span className="text-[#5b5b6b]">{r.message}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function ChangesTable({
  rows,
  showPriceUse = false,
}: {
  rows: PriceListImportRow[]
  showPriceUse?: boolean
}) {
  if (rows.length === 0) return null
  const shown = rows.slice(0, CHANGES_PREVIEW_LIMIT)
  return (
    <section className="rounded-xl border border-[#e4e4e9] bg-white">
      <div className="border-b border-[#eeeef1] px-4 py-3">
        <h3 className="text-sm font-semibold text-prominent-purple-900">What will be uploaded</h3>
        <p className="text-xs text-[#5b5b6b]">
          {rows.length > shown.length
            ? `Showing the first ${shown.length} of ${rows.length.toLocaleString()} rows.`
            : `${rows.length.toLocaleString()} row${rows.length === 1 ? '' : 's'}.`}
        </p>
      </div>
      <div className="max-h-[26rem] overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wide text-[#5b5b6b]">
            <tr className="border-b border-[#eeeef1]">
              <th className="px-4 py-2 font-semibold">Row</th>
              {showPriceUse && <th className="px-4 py-2 font-semibold">Price use</th>}
              <th className="px-4 py-2 font-semibold">Item</th>
              <th className="px-4 py-2 font-semibold">Action</th>
              <th className="px-4 py-2 text-right font-semibold">Current price</th>
              <th className="px-4 py-2 text-right font-semibold">New price</th>
              <th className="px-4 py-2 font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <ChangeRow key={`${r.row}-${r.priceUse}`} row={r} showPriceUse={showPriceUse} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ChangeRow({ row, showPriceUse }: { row: PriceListImportRow; showPriceUse: boolean }) {
  const isUpdate = row.status === 'update'
  return (
    <tr className="border-b border-[#f4f4f6] last:border-0">
      <td className={`${MONO} px-4 py-2 text-xs text-[#8b8b9b]`}>{row.row}</td>
      {showPriceUse && <td className="px-4 py-2 text-xs font-medium">{row.priceUse}</td>}
      <td className="px-4 py-2">
        <div className="font-medium text-prominent-purple-900">{row.itemName}</div>
        <div className={`${MONO} text-xs text-[#8b8b9b]`}>{row.itemSku}</div>
      </td>
      <td className="px-4 py-2">
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${
            isUpdate ? 'bg-[#f0e9fc] text-[#3f1490]' : 'bg-[#d7ebe2] text-[#0b6644]'
          }`}
        >
          {isUpdate ? 'Update' : 'Add'}
        </span>
      </td>
      <td className={`${MONO} px-4 py-2 text-right text-xs text-[#5b5b6b]`}>
        {money(row.currentPrice)}
      </td>
      <td className={`${MONO} px-4 py-2 text-right text-xs font-semibold`}>{money(row.price)}</td>
      <td className="px-4 py-2 text-xs text-[#8a4b06]">
        {row.warning}
        {row.matchedBy === 'sku' && (
          <span className="ml-1 text-[#8b8b9b]">{row.warning ? '· ' : ''}matched by SKU</span>
        )}
      </td>
    </tr>
  )
}
