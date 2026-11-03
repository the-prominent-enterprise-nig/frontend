'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Loader2, Upload } from 'lucide-react'
import { showToast } from '@/src/components/ui/toast'
import SearchableSelect, { type SearchableSelectOption } from '@/src/components/ui/SearchableSelect'
import { downloadCsv } from '@/src/libs/format/csv-export'
import { fmtMoney } from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'
import {
  commitOpeningBalance,
  previewOpeningBalance,
} from '@/src/libs/data/opening-balance-actions'
import type {
  OpeningImportResult,
  OpeningKind,
  OpeningPreview,
  OpeningRowData,
  OpeningRowStatus,
} from '@/src/schema/accounting/opening-balances'
import { OPENING_CONFIG } from './config'

type Phase = 'choose' | 'previewing' | 'review' | 'applying' | 'done'

/** Retained Earnings in the client's chart — what the opening inventory entry
 * already posts against. */
const DEFAULT_OFFSET_NUMBER = '3-01-030'

const STATUS_STYLES: Record<
  OpeningRowStatus,
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
  error: {
    label: 'Error',
    pill: 'bg-red-50 text-red-700 ring-red-200',
    edge: 'border-l-red-500',
    message: 'text-red-800',
  },
}

const todayIso = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function useEquityAccounts() {
  const [options, setOptions] = useState<SearchableSelectOption[]>([])
  const [defaultId, setDefaultId] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let live = true
    getAccounts({ limit: 500 }).then((res) => {
      if (!live) return
      const list = ((res.data as any)?.items ?? res.data ?? []) as Account[]
      const equity = list.filter((a) => a.type === 'EQUITY' && a.number)
      setOptions(equity.map((a) => ({ value: a.id, label: `${a.number} — ${a.name}` })))
      setDefaultId(equity.find((a) => a.number === DEFAULT_OFFSET_NUMBER)?.id ?? '')
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [])
  return { options, defaultId, loading }
}

export default function OpeningBalanceImportView({ kind }: { kind: OpeningKind }) {
  const config = OPENING_CONFIG[kind]
  const equity = useEquityAccounts()

  const [phase, setPhase] = useState<Phase>('choose')
  const [file, setFile] = useState<File | null>(null)
  const [asOfDate, setAsOfDate] = useState('')
  const [offsetPick, setOffsetPick] = useState('')
  const [preview, setPreview] = useState<OpeningPreview<OpeningRowData> | null>(null)
  const [result, setResult] = useState<OpeningImportResult | null>(null)
  const [problemsOnly, setProblemsOnly] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Retained Earnings is the starting choice once the chart has loaded, unless
  // they pick something else.
  const offsetId = offsetPick || equity.defaultId

  const fieldsReady = !!asOfDate && !!offsetId
  const locked = phase === 'previewing' || phase === 'review' || phase === 'applying'

  function formFor(csv: File): FormData {
    const body = new FormData()
    body.append('file', csv)
    body.append('asOfDate', asOfDate)
    body.append('offsetAccountId', offsetId)
    return body
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setResult(null)
    setProblemsOnly(false)
    setPhase('choose')
  }

  async function choose(csv: File) {
    setFile(csv)
    setPreview(null)
    setPhase('previewing')
    const res = await previewOpeningBalance(kind, formFor(csv))
    if (!res.success || !res.data) {
      showToast({ title: 'Could not read file', description: res.message, status: 'error' })
      reset()
      return
    }
    setPreview(res.data)
    setPhase('review')
  }

  async function apply() {
    if (!file) return
    setPhase('applying')
    const res = await commitOpeningBalance(kind, formFor(file))
    if (!res.success || !res.data) {
      showToast({ title: 'Import failed', description: res.message, status: 'error' })
      setPhase('review')
      return
    }
    setResult(res.data)
    setPhase('done')
  }

  const shown = useMemo(() => {
    const all = preview?.rows ?? []
    return problemsOnly ? all.filter((r) => r.status !== 'ok') : all
  }, [preview, problemsOnly])
  // Inline, not a Tailwind class: the tracks come from the config, and Tailwind
  // only generates classes it can see written out in full.
  const gridStyle = {
    gridTemplateColumns: `2rem ${config.columns.map((c) => c.track).join(' ')} 5.5rem`,
  }
  const blocked = !!preview?.blockingErrors
  const count = preview?.summary.total ?? 0
  const noun = (n: number) => (n === 1 ? config.unit.one : config.unit.many)

  return (
    <div className="px-6 py-8 lg:px-10">
      <Link
        href={config.backHref}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        {config.backLabel}
      </Link>

      <h1 className="text-2xl font-semibold text-prominent-purple-900">{config.title}</h1>
      <p className="mt-1 max-w-4xl text-sm text-gray-500">{config.intro}</p>

      {phase !== 'done' && (
        <section className="mt-6 space-y-4">
          <h2 className="text-base font-semibold text-prominent-purple-900">
            1. Cut-off date and account
          </h2>
          <div className="grid max-w-3xl grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-[14rem_minmax(0,1fr)]">
            <div>
              <label htmlFor="opening-as-of" className="text-sm font-medium text-gray-800">
                Cut-off date
              </label>
              <p className="text-xs text-gray-500">
                The date the balances are as of. The entries are dated here.
              </p>
            </div>
            <input
              id="opening-as-of"
              type="date"
              value={asOfDate}
              max={todayIso()}
              disabled={locked}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="h-10 w-56 rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-purple-700 focus:outline-none disabled:bg-gray-50"
            />

            <div>
              <span className="text-sm font-medium text-gray-800">Post against</span>
              <p className="text-xs text-gray-500">
                The equity account on the other side of every entry.
              </p>
            </div>
            <div className="max-w-md">
              <SearchableSelect
                options={equity.options}
                value={offsetId}
                onChange={(v) => setOffsetPick(v)}
                loading={equity.loading}
                disabled={locked}
                placeholder="Search an equity account…"
                ariaLabel="Account to post against"
              />
            </div>
          </div>
        </section>
      )}

      {(phase === 'choose' || phase === 'previewing') && (
        <section className="mt-8 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-prominent-purple-900">
              2. Choose your CSV
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Export your sheet as CSV (File → Download → Comma-separated values). You will see
              every row — and what would be posted — before anything is saved.
            </p>
          </div>

          <button
            type="button"
            disabled={!fieldsReady || phase === 'previewing'}
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white py-10 text-sm text-gray-500 hover:border-purple-700 hover:bg-purple-50 hover:text-purple-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {phase === 'previewing' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {phase === 'previewing'
              ? 'Reading your file…'
              : fieldsReady
                ? 'Choose CSV file'
                : 'Enter the cut-off date and account first'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="hidden"
            data-testid="opening-import-input"
            onChange={(e) => {
              const picked = e.target.files?.[0]
              // Reset so choosing the same file again (after fixing it) re-triggers.
              e.target.value = ''
              if (picked) void choose(picked)
            }}
          />
          <button
            type="button"
            onClick={() => downloadCsv(config.templateFile, config.templateHeaders, [])}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-700 hover:text-purple-900"
          >
            <Download className="h-4 w-4" />
            Download CSV template
          </button>
        </section>
      )}

      {(phase === 'review' || phase === 'applying') && preview && (
        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-prominent-purple-900">
                2. Review {file?.name}
              </h2>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">{preview.summary.total}</span> rows —{' '}
                <span className="text-emerald-700">{preview.summary.ok} OK</span>,{' '}
                <span className={preview.summary.warnings ? 'text-amber-700' : 'text-gray-500'}>
                  {preview.summary.warnings} with warnings
                </span>
                ,{' '}
                <span className={preview.summary.errors ? 'text-red-700' : 'text-gray-500'}>
                  {preview.summary.errors} with errors
                </span>
                {' · '}
                {config.amountLabel}{' '}
                <span className="font-semibold">{fmtMoney(preview.totalAmount)}</span> as of{' '}
                {preview.asOfDate}, against {preview.offsetAccount.label}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={problemsOnly}
                  onChange={(e) => setProblemsOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Only rows with errors or warnings
              </label>
              <button
                type="button"
                onClick={reset}
                disabled={phase === 'applying'}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Choose a different file
              </button>
            </div>
          </div>

          {blocked && (
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {preview.summary.errors} {preview.summary.errors === 1 ? 'row has' : 'rows have'}{' '}
                errors, so nothing can be loaded yet. Fix them in your sheet and choose the file
                again — nothing has been saved.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white">
            <div
              style={gridStyle}
              className="hidden gap-3 border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid"
            >
              <span>Row</span>
              {config.columns.map((c) => (
                <span key={c.header} className={c.align === 'right' ? 'text-right' : ''}>
                  {c.header}
                </span>
              ))}
              <span>Status</span>
            </div>
            {shown.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No rows to show.</p>
            ) : (
              shown.map((row) => {
                const style = STATUS_STYLES[row.status]
                return (
                  <div
                    key={row.rowNumber}
                    className={`border-b border-gray-100 border-l-[3px] px-4 py-2.5 text-sm last:border-b-0 ${style.edge}`}
                  >
                    <div style={gridStyle} className="grid gap-3">
                      <span className="text-gray-500">{row.rowNumber}</span>
                      {config.columns.map((c) => (
                        <span
                          key={c.header}
                          className={`min-w-0 break-words text-gray-800 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}
                        >
                          {c.render(row.data)}
                        </span>
                      ))}
                      <span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.pill}`}
                        >
                          {style.label}
                        </span>
                      </span>
                    </div>
                    {row.messages.length > 0 && (
                      <ul
                        className={`mt-1 list-disc space-y-0.5 pl-12 text-[13px] ${style.message}`}
                      >
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

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <button
              type="button"
              onClick={() => void apply()}
              disabled={blocked || count === 0 || phase === 'applying'}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {phase === 'applying' && <Loader2 className="h-4 w-4 animate-spin" />}
              {phase === 'applying' ? 'Loading…' : `Load ${count} ${noun(count)}`}
            </button>
          </div>
        </section>
      )}

      {phase === 'done' && result && (
        <section className="mt-6 space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div className="text-sm text-emerald-900">
              <p className="font-semibold">
                Loaded {result.imported} {noun(result.imported)} — {fmtMoney(result.totalAmount)} as
                of {result.asOfDate}.
              </p>
              <p className="mt-0.5">
                Each one has its own journal entry; nothing else was changed.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={config.doneHref}
              className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-800"
            >
              {config.doneLabel}
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
    </div>
  )
}
