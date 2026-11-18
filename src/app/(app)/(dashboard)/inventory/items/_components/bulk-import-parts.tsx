'use client'

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CopyCheck,
  Download,
  FileText,
  PackagePlus,
} from 'lucide-react'
import {
  downloadSkippedRows,
  SKIPPED_STATUS_LABELS,
} from '@/src/app/(app)/(dashboard)/pos/price-lists/_lib/upload-template'
import { TargetsTable } from '@/src/app/(app)/(dashboard)/pos/price-lists/_components/upload/TargetsTable'
import type { BulkImportItemsResult } from '@/src/schema/inventory/items/bulk-import'
import type { PriceListImportResult } from '@/src/schema/inventory/price-lists/import'
import type { ItemImportPreview } from '../_lib/item-import-preview'
import {
  downloadItemUploadTemplate,
  ITEM_UPLOAD_TEMPLATE_HEADERS,
} from '../_lib/item-upload-template'

const SECTION_LABEL = 'text-[12px] font-semibold uppercase tracking-wide text-ink-subtle'
const LINK_BUTTON =
  'inline-flex items-center gap-1 text-[12px] font-medium text-[#5b21b6] hover:text-[#4c1a9b]'

// ─── Preview table ──────────────────────────────────────────────────────────

/** A small grid of CSV rows. Columns the upload ignores are greyed out and
 * struck through so the user sees at a glance what won't be read. */
export function PreviewTable({
  headers,
  recognized,
  rows,
}: {
  headers: string[]
  recognized: boolean[]
  rows: string[][]
}): React.JSX.Element {
  const cellTone = (i: number): string => (recognized[i] ? 'text-[#1d1d26]' : 'text-ink-faint')
  return (
    <div className="overflow-x-auto rounded-lg border border-[#eeeef1]">
      <table className="w-full text-left text-[12px]">
        <thead className="bg-[#fbfbfc]">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className={`whitespace-nowrap px-3 py-2 font-semibold ${recognized[i] ? 'text-[#3d3d4a]' : 'text-ink-faint line-through'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eeeef1]">
          {rows.map((row, r) => (
            <tr key={r}>
              {headers.map((_, i) => (
                <td key={i} className={`whitespace-nowrap px-3 py-1.5 ${cellTone(i)}`}>
                  {row[i] || <span className="text-ink-faint">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Format guide (no file yet) ─────────────────────────────────────────────

const Y19_ITEM = ['VIVO', 'Y19s', 'Cellphone', 'Gadgets', 'Smartphone']
const NO_TERMS = ['', '', '', '', '', '', '', '', '', '']
const SAMPLE_ROWS: string[][] = [
  [...Y19_ITEM, 'CASH', '8,999', '', ...NO_TERMS, 'SN-0001', 'Iloilo City', '', '', '7,500'],
  [
    ...Y19_ITEM,
    'INSTALLMENT',
    '10,999',
    '1,000',
    '3,666',
    '333',
    '1,833',
    '166',
    '',
    '',
    '',
    '',
    '',
    '',
    'SN-0002',
    'Iloilo City',
    '',
    '',
    '7,500',
  ],
]

const RULES = [
  'Each MODEL becomes one item, named “BRAND MODEL”; TYPE, CATEGORY and SUBGROUP are created if new. Models already in the catalog aren’t duplicated.',
  'Prices go to the list for the row’s PRICE USE — blank cells clear that value, and a live list goes back to pending approval.',
  'Leave the price cells or the unit cells blank on a row that only needs the other.',
]

type KeyGroup = {
  title: string
  when: string
  required: string[]
  optional: string[]
  notes: string[]
}

/** What each part of a row needs — mirrors the backend's row checks
 * (ItemsService, price list row parser, ItemBulkUploadService units). */
const COLUMN_KEY: KeyGroup[] = [
  {
    title: 'Item',
    when: 'Every row — MODEL is the only column always required.',
    required: ['MODEL'],
    optional: ['BRAND', 'TYPE', 'CATEGORY', 'SUBGROUP'],
    notes: ['SUBGROUP needs CATEGORY on the same row.'],
  },
  {
    title: 'Price (optional)',
    when: 'Skip it, or fill PRICE USE / PRICE — then the purple ones are required.',
    required: ['BRAND', 'PRICE USE', 'PRICE'],
    optional: ['DOWN PAYMENT', 'MI / PPD terms', 'CREDIT', 'CM'],
    notes: ['Each term needs both MI and PPD, or neither.'],
  },
  {
    title: 'Unit (optional)',
    when: 'Skip it, or fill SERIAL — then BRANCH is required too.',
    required: ['SERIAL', 'BRANCH'],
    optional: ['DATE IN', 'RR', 'COST', 'ORIGIN', 'CLASSIFICATION'],
    notes: [
      'Blank DATE IN = today; blank RR = one generated per branch.',
      "ORIGIN is the supplier — blank, WHSE or the branch's own code means none.",
      'CLASSIFICATION: Brand New (blank), Repair, Repo or Return.',
    ],
  },
]

function KeyChip({ label, required }: { label: string; required: boolean }): React.JSX.Element {
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
        required ? 'bg-[#5b21b6] text-white' : 'border border-[#d3d3db] bg-white text-ink-muted'
      }`}
    >
      {label}
    </span>
  )
}

function ColumnKey(): React.JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-[11px] text-ink-subtle">
        <span className="inline-flex items-center gap-1.5">
          <KeyChip label="A" required /> Required (within that part)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <KeyChip label="A" required={false} /> Optional
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {COLUMN_KEY.map((g) => (
          <div key={g.title} className="rounded-lg border border-[#eeeef1] bg-[#fbfbfc] p-2.5">
            <p className="text-[12px] font-semibold text-[#1d1d26]">{g.title}</p>
            <p className="mb-2 text-[11px] text-ink-subtle">{g.when}</p>
            <div className="flex flex-wrap gap-1">
              {g.required.map((c) => (
                <KeyChip key={c} label={c} required />
              ))}
              {g.optional.map((c) => (
                <KeyChip key={c} label={c} required={false} />
              ))}
            </div>
            {g.notes.map((n) => (
              <p key={n} className="mt-2 text-[11px] text-ink-subtle">
                {n}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function FormatGuide(): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className={SECTION_LABEL}>Item upload template</p>
        <button type="button" onClick={downloadItemUploadTemplate} className={LINK_BUTTON}>
          <Download className="h-3.5 w-3.5" />
          Download template
        </button>
      </div>
      <PreviewTable
        headers={ITEM_UPLOAD_TEMPLATE_HEADERS}
        recognized={ITEM_UPLOAD_TEMPLATE_HEADERS.map(() => true)}
        rows={SAMPLE_ROWS}
      />
      <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#5b21b6]" />1 item (VIVO Y19s), priced on
        CASH and INSTALLMENT, with 2 units on hand at Iloilo City.
      </p>
      <ColumnKey />
      <details className="text-[12px] text-ink-muted">
        <summary className="cursor-pointer select-none font-medium text-[#3d3d4a] hover:text-[#5b21b6]">
          How it works
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}

// ─── File preview (file chosen) ─────────────────────────────────────────────

function Stat({ value, label }: { value: number; label: string }): React.JSX.Element {
  return (
    <span className="rounded-full bg-[#f4f4f6] px-2.5 py-0.5 text-[12px] text-ink-muted">
      <span className="font-semibold text-[#1d1d26]">{value}</span> {label}
    </span>
  )
}

function PreviewStats({
  preview,
  canSetPrices,
}: {
  preview: ItemImportPreview
  canSetPrices?: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Stat value={preview.totalRows} label="rows" />
      {preview.uniqueModels > 0 && <Stat value={preview.uniqueModels} label="models" />}
      {preview.unitRows > 0 && <Stat value={preview.unitRows} label="units" />}
      {preview.hasPrices && !canSetPrices && (
        <span className="text-[12px] text-[#8a4b06]">
          Prices won’t be saved — that needs price list edit rights.
        </span>
      )}
    </div>
  )
}

export function FilePreview({
  fileName,
  preview,
  canSetPrices,
  onChange,
}: {
  fileName: string
  preview: ItemImportPreview
  canSetPrices?: boolean
  onChange: () => void
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-[#eeeef1] px-3 py-2">
        <FileText className="h-4 w-4 shrink-0 text-[#5b21b6]" />
        <span className="truncate text-[13px] font-medium text-[#1d1d26]">{fileName}</span>
        <button
          type="button"
          onClick={onChange}
          className="ml-auto shrink-0 text-[12px] font-medium text-ink-muted hover:text-[#5b21b6]"
        >
          Change
        </button>
      </div>
      {preview.problem ? (
        <p className="flex items-start gap-2 rounded-lg border border-[#f3c9c5] bg-[#fdeceb] px-3 py-2 text-[12px] text-[#b42318]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {preview.problem}
        </p>
      ) : (
        <PreviewStats preview={preview} canSetPrices={canSetPrices} />
      )}
      {preview.headers.length > 0 && (
        <>
          <PreviewTable
            headers={preview.headers}
            recognized={preview.recognized}
            rows={preview.sampleRows}
          />
          {preview.totalRows > preview.sampleRows.length && (
            <p className="text-[12px] text-ink-subtle">
              Showing the first {preview.sampleRows.length} of {preview.totalRows} rows.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ─── Result ─────────────────────────────────────────────────────────────────

function ResultTile({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode
  value: number
  label: string
  tone: string
}): React.JSX.Element {
  return (
    <div className={`rounded-xl border p-3 text-center ${tone}`}>
      <div className="mb-1 flex justify-center">{icon}</div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[12px]">{label}</p>
    </div>
  )
}

export function ImportResult({
  result,
  onDownloadErrors,
}: {
  result: BulkImportItemsResult
  onDownloadErrors: () => void
}): React.JSX.Element {
  const skipped = new Set((result.skippedExisting ?? []).map((s) => s.model)).size
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResultTile
          icon={<CheckCircle2 className="h-5 w-5" />}
          value={result.created.length}
          label="Items created"
          tone="border-green-200 bg-green-50 text-green-700"
        />
        <ResultTile
          icon={<CopyCheck className="h-5 w-5" />}
          value={skipped}
          label="Already in catalog"
          tone="border-[#eeeef1] bg-[#fbfbfc] text-ink-muted"
        />
        <ResultTile
          icon={<PackagePlus className="h-5 w-5" />}
          value={result.units?.created ?? 0}
          label="Units recorded"
          tone="border-prominent-purple-200 bg-prominent-purple-50 text-prominent-purple-800"
        />
        <ResultTile
          icon={<AlertCircle className="h-5 w-5" />}
          value={result.errors.length + (result.units?.errors.length ?? 0)}
          label="Problems"
          tone="border-red-200 bg-red-50 text-red-600"
        />
      </div>
      {result.errors.length > 0 && (
        <RowProblems
          title="Item rows"
          lines={result.errors.map((e) => ({ row: e.row, label: e.sku, error: e.error }))}
          onDownload={onDownloadErrors}
        />
      )}
      {!!result.units?.errors.length && (
        <RowProblems
          title="Unit rows"
          lines={result.units.errors.map((e) => ({ row: e.row, label: e.serial, error: e.error }))}
        />
      )}
      <PriceSection prices={result.prices} />
    </div>
  )
}

function RowProblems({
  title,
  lines,
  onDownload,
}: {
  title: string
  lines: { row: number; label?: string; error: string }[]
  onDownload?: () => void
}): React.JSX.Element {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-red-500">{title}</p>
        {onDownload && (
          <button type="button" onClick={onDownload} className={LINK_BUTTON}>
            <Download className="h-3.5 w-3.5" />
            Download CSV
          </button>
        )}
      </div>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {lines.map((l, i) => (
          <li key={i} className="flex gap-2 text-[12px] text-red-600">
            <span className="font-mono text-ink-faint">Row {l.row}</span>
            {l.label && <span className="font-mono font-semibold">{l.label}</span>}
            <span className="text-red-400">—</span>
            <span>{l.error}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Prices ─────────────────────────────────────────────────────────────────

function PriceNote({
  tone,
  children,
}: {
  tone: 'warn' | 'error'
  children: React.ReactNode
}): React.JSX.Element {
  const cls =
    tone === 'error'
      ? 'border-[#f3c9c5] bg-[#fdeceb] text-[#b42318]'
      : 'border-amber-200 bg-amber-50 text-amber-800'
  return <p className={`rounded-lg border px-3 py-2 text-[12px] ${cls}`}>{children}</p>
}

function PriceSection({
  prices,
}: {
  prices: BulkImportItemsResult['prices']
}): React.JSX.Element | null {
  if (!prices || prices.status === 'no_price_columns') return null
  if (prices.status === 'no_access') {
    return (
      <PriceNote tone="warn">
        Prices were not saved — that needs price list edit rights. Someone with access can upload
        the same file again; existing items and serials are skipped.
      </PriceNote>
    )
  }
  if (prices.status === 'failed') {
    return <PriceNote tone="error">Prices were not saved: {prices.message}</PriceNote>
  }
  return <PriceSummary result={prices.result} />
}

function PriceSummary({ result }: { result: PriceListImportResult }): React.JSX.Element {
  const notPriced = result.rows.filter((r) => r.status !== 'create' && r.status !== 'update')
  const sentForApproval = result.targets.some(
    (t) => t.listStatusAfter === 'pending_approval' && t.listStatus !== 'pending_approval'
  )
  return (
    <div className="space-y-2">
      <p className={SECTION_LABEL}>
        Prices — {result.applied?.created ?? 0} added, {result.applied?.updated ?? 0} updated
      </p>
      <TargetsTable targets={result.targets} />
      {sentForApproval && (
        <PriceNote tone="warn">
          Live lists that got new prices are back in pending approval until approved.
        </PriceNote>
      )}
      {notPriced.length > 0 && <NotPricedRows rows={notPriced} />}
    </div>
  )
}

function NotPricedRows({ rows }: { rows: PriceListImportResult['rows'] }): React.JSX.Element {
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-muted">
      <span>{rows.length} row(s) not priced:</span>
      {[...counts].map(([status, n]) => (
        <span key={status}>
          {SKIPPED_STATUS_LABELS[status] ?? status} ({n})
        </span>
      ))}
      <button type="button" onClick={() => downloadSkippedRows(rows)} className={LINK_BUTTON}>
        <Download className="h-3.5 w-3.5" />
        Download
      </button>
    </div>
  )
}
