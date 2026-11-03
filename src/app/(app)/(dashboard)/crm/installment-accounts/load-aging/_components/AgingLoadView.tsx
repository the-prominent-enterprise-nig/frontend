'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Loader2, Upload } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import { downloadCsv } from '@/src/libs/format/csv-export'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import {
  getAgingLoadStatus,
  previewAgingLoad,
  startAgingLoad,
} from '@/src/libs/data/aging-load-actions'
import {
  AGING_TEMPLATE_HEADERS,
  type AgingLoadStatus,
  type AgingPreview,
  type AgingPreviewRow,
  type AgingRowStatus,
  type AgingUnmatched,
} from '@/src/schema/crm/aging-load'

type Phase = 'choose' | 'previewing' | 'review' | 'loading' | 'done' | 'failed'

const POLL_MS = 1500

const num = (n: number) => n.toLocaleString('en-PH')
const plural = (n: number, one: string, many: string) => `${num(n)} ${n === 1 ? one : many}`

const STATUS_STYLES: Record<
  AgingRowStatus,
  { label: string; pill: string; edge: string; message: string }
> = {
  ok: {
    label: 'OK',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    edge: 'border-l-transparent',
    message: 'text-gray-700',
  },
  warning: {
    label: 'Warning',
    pill: 'bg-amber-50 text-amber-800 ring-amber-200',
    edge: 'border-l-amber-400',
    message: 'text-amber-900',
  },
  skipped: {
    label: 'Skipped',
    pill: 'bg-gray-100 text-gray-700 ring-gray-300',
    edge: 'border-l-gray-400',
    message: 'text-gray-700',
  },
  error: {
    label: 'Error',
    pill: 'bg-red-50 text-red-700 ring-red-200',
    edge: 'border-l-red-500',
    message: 'text-red-800',
  },
}

const ACTION_LABEL = { create: 'Create', update: 'Update', skip: 'Skip' } as const

/** A 5 MB sheet is ~1 MB gzipped: the hosting provider caps a request at
 * 4.5 MB, and it is sent twice (check, then load). The server unzips it. */
async function compress(file: File): Promise<File> {
  if (typeof CompressionStream === 'undefined') return file
  try {
    const stream = file.stream().pipeThrough(new CompressionStream('gzip'))
    const blob = await new Response(stream).blob()
    return new File([blob], `${file.name}.gz`, { type: 'application/gzip' })
  } catch {
    return file
  }
}

function UnmatchedNote({
  title,
  rows,
  items,
  outcome,
}: {
  title: string
  rows: number
  items: AgingUnmatched[]
  outcome: string
}) {
  if (rows === 0) return null
  return (
    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">
          {title}: {plural(rows, 'account', 'accounts')}
        </p>
        <p className="mt-0.5">
          {outcome} Most common:{' '}
          {items
            .slice(0, 8)
            .map((i) => `${i.value} (${num(i.count)})`)
            .join(', ')}
          {items.length > 8 ? ', …' : ''}
        </p>
      </div>
    </div>
  )
}

function RowTable({ rows, empty }: { rows: AgingPreviewRow[]; empty: string }) {
  const grid = { gridTemplateColumns: '3rem 1.2fr 2fr 0.8fr 0.6fr 0.6fr 1fr 1fr 6rem' }
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div
        style={grid}
        className="hidden gap-3 border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid"
      >
        <span>Row</span>
        <span>SI No.</span>
        <span>Customer</span>
        <span>Branch</span>
        <span>Cat.</span>
        <span className="text-right">Term</span>
        <span className="text-right">MI</span>
        <span className="text-right">Balance</span>
        <span>Status</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-gray-400">{empty}</p>
      ) : (
        rows.map((row) => {
          const style = STATUS_STYLES[row.status]
          const d = row.data
          return (
            <div
              key={row.rowNumber}
              className={`border-b border-gray-100 border-l-[3px] px-4 py-2.5 text-sm last:border-b-0 ${style.edge}`}
            >
              <div style={grid} className="grid gap-3">
                <span className="text-gray-500">{row.rowNumber}</span>
                <span className="min-w-0 break-words text-gray-800">{d.siNo || '—'}</span>
                <span className="min-w-0 break-words text-gray-800">{d.customerName || '—'}</span>
                <span className="text-gray-800">{d.branchCode || '—'}</span>
                <span className="text-gray-800">{d.category ?? '—'}</span>
                <span className="text-right tabular-nums text-gray-800">{d.term ?? '—'}</span>
                <span className="text-right tabular-nums text-gray-800">
                  {d.monthlyInstallment === null ? '—' : fmtMoney(d.monthlyInstallment)}
                </span>
                <span className="text-right tabular-nums text-gray-800">
                  {d.balance === null ? '—' : fmtMoney(d.balance)}
                </span>
                <span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.pill}`}
                  >
                    {row.status === 'ok' ? ACTION_LABEL[row.action] : style.label}
                  </span>
                </span>
              </div>
              {row.messages.length > 0 && (
                <ul className={`mt-1 list-disc space-y-0.5 pl-12 text-[13px] ${style.message}`}>
                  {row.messages.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

export default function AgingLoadView() {
  const [phase, setPhase] = useState<Phase>('choose')
  const [file, setFile] = useState<File | null>(null)
  const [upload, setUpload] = useState<File | null>(null)
  const [preview, setPreview] = useState<AgingPreview | null>(null)
  const [status, setStatus] = useState<AgingLoadStatus | null>(null)
  const [failure, setFailure] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const jobId = status?.jobId

  function formFor(csv: File): FormData {
    const body = new FormData()
    body.append('file', csv, csv.name)
    return body
  }

  function reset() {
    setFile(null)
    setUpload(null)
    setPreview(null)
    setStatus(null)
    setFailure('')
    setPhase('choose')
  }

  async function choose(csv: File) {
    setFile(csv)
    setPreview(null)
    setPhase('previewing')
    const zipped = await compress(csv)
    setUpload(zipped)
    const res = await previewAgingLoad(formFor(zipped))
    if (!res.success || !res.data) {
      showToast({ title: 'Could not read file', description: res.message, status: 'error' })
      reset()
      return
    }
    setPreview(res.data)
    setPhase('review')
  }

  async function apply() {
    if (!upload) return
    setPhase('loading')
    const res = await startAgingLoad(formFor(upload))
    if (!res.success || !res.data) {
      showToast({ title: 'Could not start the load', description: res.message, status: 'error' })
      setPhase('review')
      return
    }
    setStatus(res.data)
  }

  // Progress: the load runs on the server in batches; ask how far it is.
  useEffect(() => {
    if (phase !== 'loading' || !jobId) return
    let live = true
    let busy = false
    const timer = setInterval(async () => {
      if (busy) return
      busy = true
      const res = await getAgingLoadStatus(jobId)
      busy = false
      if (!live) return
      if (!res.success || !res.data) {
        // The server forgot the load (a restart): what was saved stays saved.
        setFailure(res.message ?? 'The load could not be followed.')
        setPhase('failed')
        return
      }
      setStatus(res.data)
      if (res.data.state === 'done') setPhase('done')
      if (res.data.state === 'failed') {
        setFailure(res.data.error ?? 'The load stopped.')
        setPhase('failed')
      }
    }, POLL_MS)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [phase, jobId])

  const blocked = !!preview?.blockingErrors
  const toLoad = preview?.totals.accounts ?? 0
  const s = preview?.summary
  const percent =
    status && status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href="/crm/installment-accounts"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Installment Accounts
      </Link>

      <h1 className="text-2xl font-semibold text-prominent-purple-900">Load AR Aging</h1>
      <p className="mt-1 max-w-4xl text-sm text-gray-500">
        Load the aging sheet — one row per sale — as installment accounts. Each sale becomes an
        account with its AR invoice, under its customer (new customers are created). No journal
        entries are posted. Every row is checked first and nothing is saved until you confirm.
        Loading the same sheet again updates the accounts already loaded instead of duplicating
        them.
      </p>

      {(phase === 'choose' || phase === 'previewing') && (
        <section className="mt-8 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-prominent-purple-900">
              1. Choose your CSV
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              The aging export saved as CSV, in the sheet&apos;s 60-column layout with the header on
              the first row. The columns are read by position, so do not insert, remove or reorder
              any. Dates are MM-DD-YYYY.
            </p>
          </div>

          <button
            type="button"
            disabled={phase === 'previewing'}
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white py-10 text-sm text-gray-500 hover:border-purple-700 hover:bg-purple-50 hover:text-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {phase === 'previewing' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {phase === 'previewing' ? 'Reading your file…' : 'Choose CSV file'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="hidden"
            data-testid="aging-load-input"
            onChange={(e) => {
              const picked = e.target.files?.[0]
              // Reset so choosing the same file again (after fixing it) re-triggers.
              e.target.value = ''
              if (picked) void choose(picked)
            }}
          />
          <button
            type="button"
            onClick={() => downloadCsv('ar-aging-template.csv', AGING_TEMPLATE_HEADERS, [])}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-700 hover:text-purple-900"
          >
            <Download className="h-4 w-4" />
            Download CSV template
          </button>
        </section>
      )}

      {phase === 'review' && preview && s && (
        <section className="mt-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-prominent-purple-900">
                2. Review {file?.name}
              </h2>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{num(s.read)}</span> sales read —{' '}
                <span className="text-emerald-700">{num(s.create)} to create</span>,{' '}
                <span className="text-emerald-700">{num(s.update)} to update</span>,{' '}
                <span className={s.skipped ? 'text-gray-900' : 'text-gray-500'}>
                  {num(s.skipped)} skipped
                </span>
                ,{' '}
                <span className={s.warnings ? 'text-amber-700' : 'text-gray-500'}>
                  {num(s.warnings)} with warnings
                </span>
                ,{' '}
                <span className={s.errors ? 'text-red-700' : 'text-gray-500'}>
                  {num(s.errors)} with errors
                </span>
                {' · '}Balance{' '}
                <span className="font-semibold">{fmtMoney(preview.totals.outstanding)}</span>
              </p>
              <p className="mt-0.5 text-sm text-gray-500">
                Customers: {plural(preview.matching.customersMatched, 'match', 'matches')} to
                existing customers by name, {num(preview.matching.customersNew)} new to be created.
                An account already loaded keeps its customer, branch and collector.
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
            >
              Choose a different file
            </button>
          </div>

          {blocked && (
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {plural(s.errors, 'row has', 'rows have')} errors, so nothing can be loaded yet. Fix
                them in your sheet and choose the file again — nothing has been saved.
              </p>
            </div>
          )}

          <UnmatchedNote
            title="Branch code not matched to one branch"
            rows={preview.matching.branchUnmatchedRows}
            items={preview.matching.branchUnmatched}
            outcome="These load without a branch, so branch-assigned users will not see them until one is set."
          />
          <UnmatchedNote
            title="Collector not found"
            rows={preview.matching.collectorUnmatchedRows}
            items={preview.matching.collectorUnmatched}
            outcome="These load without a collector."
          />

          {preview.flaggedTotal > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-prominent-purple-900">
                Rows to look at
                {preview.flaggedTotal > preview.rows.length
                  ? ` — first ${num(preview.rows.length)} of ${num(preview.flaggedTotal)}`
                  : ` — ${num(preview.flaggedTotal)}`}
              </h3>
              <RowTable rows={preview.rows} empty="No rows to show." />
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-prominent-purple-900">
              First rows to load — check the columns line up
            </h3>
            <RowTable rows={preview.sample} empty="Nothing in this file will be loaded." />
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => void apply()}
              disabled={blocked || toLoad === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Load {plural(toLoad, 'account', 'accounts')}
            </button>
          </div>
        </section>
      )}

      {phase === 'loading' && (
        <section className="mt-8 space-y-3" data-testid="aging-load-progress">
          <h2 className="text-base font-semibold text-prominent-purple-900">3. Loading</h2>
          <p className="text-sm text-gray-700">
            {status
              ? `${num(status.processed)} of ${num(status.total)} accounts saved`
              : 'Starting…'}
            . Keep this page open until it finishes.
          </p>
          <div className="h-2 max-w-xl overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-purple-700 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </section>
      )}

      {phase === 'done' && status && (
        <section className="mt-6 space-y-4" data-testid="aging-load-done">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div className="text-sm text-emerald-900">
              <p className="font-semibold">
                Loaded {plural(status.total, 'account', 'accounts')} —{' '}
                {fmtMoney(status.outstanding)} balance.
              </p>
              <p className="mt-0.5">
                {num(status.created)} created, {num(status.updated)} updated,{' '}
                {plural(status.customersCreated, 'new customer', 'new customers')}
                {status.skipped > 0 ? `, ${num(status.skipped)} rows skipped` : ''}. Every account
                was read back to confirm it saved.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/crm/installment-accounts"
              className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
            >
              View installment accounts
            </Link>
            <Link
              href="/crm/installment-accounts/aging-report"
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              View AR Aging Report
            </Link>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Load another file
            </button>
          </div>
        </section>
      )}

      {phase === 'failed' && (
        <section className="mt-6 space-y-4" data-testid="aging-load-failed">
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
            <div className="text-sm text-red-900">
              <p className="font-semibold">The load did not finish</p>
              <p className="mt-0.5 whitespace-pre-line break-words">{failure}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
          >
            Choose the file again
          </button>
        </section>
      )}
    </div>
  )
}
