'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TaxCodes, type TaxCodeOption, type TaxCodeType } from '@/src/libs/data/AccountingV2Data'
import type {
  ExceptionKind,
  ExceptionModule,
  TaxReportMeta,
  TaxReportQuery,
} from '@/src/libs/data/TaxReportsData'
import {
  getBranches,
  type BranchDetail,
} from '@/src/app/(app)/(dashboard)/settings/_actions/get-branches'
import ExportButton from '@/src/components/common/ExportButton'
import {
  EXCEPTION_KIND_LABEL,
  EXCEPTION_MODULE_LABEL,
  PERIOD_PRESETS,
  manilaToday,
  presetPeriod,
  type PeriodPreset,
} from '@/src/libs/tax/tax-reports'
import VatSummaryView from './VatSummaryView'
import OutputVatView from './OutputVatView'
import InputVatView from './InputVatView'
import EwtView from './EwtView'
import CwtView from './CwtView'
import ReconciliationView from './ReconciliationView'
import ExceptionsView from './ExceptionsView'

// Scenario 69 Parts H and I — the tax reports. One screen, seven tabs, one period
// and one set of filters: the same cut of the books read six ways, each with an
// Excel export that carries exactly what is on screen, and a seventh tab (Part I)
// that lists the tax codes somebody changed from their defaults or left out.

type Report =
  | 'vat-summary'
  | 'output-vat'
  | 'input-vat'
  | 'ewt-schedule'
  | 'cwt-schedule'
  | 'reconciliation'
  | 'exceptions'

const TABS: { key: Report; label: string; blurb: string }[] = [
  {
    key: 'vat-summary',
    label: 'VAT Summary',
    blurb: 'Output VAT, Input VAT and the net, month by month: what the return is prepared from.',
  },
  {
    key: 'output-vat',
    label: 'Output VAT Detail',
    blurb:
      'Every sale and invoice with its VAT class, base and tax: reconcile it to the sales reports.',
  },
  {
    key: 'input-vat',
    label: 'Input VAT Detail',
    blurb: 'Every purchase line that carries VAT, with its code and class: check the claims.',
  },
  {
    key: 'ewt-schedule',
    label: 'EWT Payable',
    blurb: 'Tax withheld from suppliers by supplier and ATC: what to remit and what to certify.',
  },
  {
    key: 'cwt-schedule',
    label: 'Creditable WHT',
    blurb: 'Tax customers withheld from NIG, with the 2307 certificates still to come.',
  },
  {
    key: 'reconciliation',
    label: 'GL Reconciliation',
    blurb: 'The tax accounts of the General Ledger against the documents behind them.',
  },
  {
    key: 'exceptions',
    label: 'Exceptions',
    blurb:
      'Tax codes changed from their defaults, with who and why, and the codes that are missing: review these before the month is closed.',
  },
]

const VALID: Report[] = TABS.map((t) => t.key)

/** Which tax code types a report can be cut by. */
const CODE_TYPES: Partial<Record<Report, TaxCodeType[]>> = {
  'vat-summary': ['OUTPUT_VAT', 'INPUT_VAT'],
  'output-vat': ['OUTPUT_VAT'],
  'input-vat': ['INPUT_VAT'],
  'ewt-schedule': ['EWT_PAYABLE'],
}

const isDay = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

const input = 'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm'
const label = 'mb-1 block text-xs font-medium text-gray-600'

export default function TaxReportsHub({ canClose }: { canClose: boolean }) {
  const router = useRouter()
  const params = useSearchParams()
  const initial = params.get('report') as Report | null
  // a link from the month-end checklist names the days it means
  const from = params.get('from')
  const to = params.get('to')
  const linked = isDay(from) && isDay(to) ? { startDate: from, endDate: to } : null
  const [report, setReport] = useState<Report>(
    initial && VALID.includes(initial) ? initial : 'vat-summary'
  )
  const [preset, setPreset] = useState<PeriodPreset>(linked ? 'custom' : 'this-month')
  const [period, setPeriod] = useState(() => linked ?? presetPeriod('this-month'))
  const [branchId, setBranchId] = useState('')
  const [taxCode, setTaxCode] = useState('')
  const [search, setSearch] = useState('')
  const [atc, setAtc] = useState('')
  const [certificateStatus, setCertificateStatus] = useState('')
  const [projectAssetRef, setProjectAssetRef] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [meta, setMeta] = useState<TaxReportMeta | null>(null)
  const [branches, setBranches] = useState<BranchDetail[]>([])
  const [codes, setCodes] = useState<TaxCodeOption[]>([])

  useEffect(() => {
    getBranches().then((r) => setBranches(r.success && r.data ? r.data : []))
    TaxCodes.options().then((r) => setCodes(r.success && r.data ? r.data : []))
  }, [])

  const choose = (next: Report) => {
    setReport(next)
    // each report reads its own filters: do not carry one over to a report it means nothing to
    setTaxCode('')
    setAtc('')
    setCertificateStatus('')
    setProjectAssetRef('')
    setModuleFilter('')
    setKindFilter('')
    setUserFilter('')
    router.replace(`?report=${next}`, { scroll: false })
  }

  const applyPreset = (p: PeriodPreset) => {
    setPreset(p)
    if (p !== 'custom') setPeriod(presetPeriod(p))
  }

  const today = manilaToday()
  const query: TaxReportQuery = useMemo(
    () => ({
      startDate: period.startDate,
      endDate: period.endDate,
      branchId: branchId || undefined,
      taxCode: taxCode || undefined,
      search: search.trim() || undefined,
      atc:
        report === 'ewt-schedule' || report === 'cwt-schedule'
          ? atc.trim() || undefined
          : undefined,
      certificateStatus:
        report === 'cwt-schedule' && certificateStatus
          ? (certificateStatus as TaxReportQuery['certificateStatus'])
          : undefined,
      projectAssetRef: report === 'input-vat' ? projectAssetRef.trim() || undefined : undefined,
      module: report === 'exceptions' ? moduleFilter || undefined : undefined,
      kind: report === 'exceptions' ? kindFilter || undefined : undefined,
      userId: report === 'exceptions' ? userFilter || undefined : undefined,
    }),
    [
      period,
      branchId,
      taxCode,
      search,
      atc,
      certificateStatus,
      projectAssetRef,
      moduleFilter,
      kindFilter,
      userFilter,
      report,
    ]
  )

  const types = CODE_TYPES[report]
  const codeOptions = types ? codes.filter((c) => types.includes(c.taxType)) : []
  const ready = !!period.startDate && !!period.endDate && period.startDate <= period.endDate
  const tab = TABS.find((t) => t.key === report)!
  const slug: Record<Report, string> = {
    'vat-summary': 'vat-summary',
    'output-vat': 'output-vat',
    'input-vat': 'input-vat',
    'ewt-schedule': 'ewt-schedule',
    'cwt-schedule': 'cwt-schedule',
    reconciliation: 'reconciliation',
    exceptions: 'exceptions',
  }
  const cutBy = (patch: { kind?: string; module?: string; userId?: string }) => {
    if (patch.kind !== undefined) setKindFilter(patch.kind)
    if (patch.module !== undefined) setModuleFilter(patch.module)
    if (patch.userId !== undefined) setUserFilter(patch.userId)
  }

  return (
    <div className="px-6 py-6 lg:px-10">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-prominent-purple-900">Tax Reports</h1>
        <p className="mt-1 text-sm text-gray-500">
          VAT and withholding tax, read from the General Ledger with the document behind every
          entry. Periods are Manila calendar days.
        </p>
      </div>

      <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={report === t.key}
            data-testid={`tab-${t.key}`}
            onClick={() => choose(t.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              report === t.key
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mb-4 text-[13px] text-gray-500">{tab.blurb}</p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className={label}>Period</span>
          <select
            aria-label="Period"
            value={preset}
            onChange={(e) => applyPreset(e.target.value as PeriodPreset)}
            className={input}
          >
            {PERIOD_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>From</span>
          <input
            type="date"
            aria-label="From"
            value={period.startDate}
            max={today}
            onChange={(e) => {
              setPreset('custom')
              setPeriod({ ...period, startDate: e.target.value })
            }}
            className={input}
          />
        </label>
        <label className="block">
          <span className={label}>To</span>
          <input
            type="date"
            aria-label="To"
            value={period.endDate}
            max={today}
            onChange={(e) => {
              setPreset('custom')
              setPeriod({ ...period, endDate: e.target.value })
            }}
            className={input}
          />
        </label>
        {meta?.branchLocked ? (
          <div className="pb-2 text-sm text-gray-700" data-testid="branch-locked">
            Showing <b>{meta.branchName}</b> only
          </div>
        ) : (
          branches.length > 0 && (
            <label className="block">
              <span className={label}>Branch</span>
              <select
                aria-label="Branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className={input}
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )
        )}
        {codeOptions.length > 0 && (
          <label className="block">
            <span className={label}>Tax code</span>
            <select
              aria-label="Tax code"
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              className={input}
            >
              <option value="">All codes</option>
              {codeOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </label>
        )}
        {report === 'cwt-schedule' && (
          <label className="block">
            <span className={label}>Certificate</span>
            <select
              aria-label="Certificate"
              value={certificateStatus}
              onChange={(e) => setCertificateStatus(e.target.value)}
              className={input}
            >
              <option value="">All</option>
              <option value="missing">2307 not received</option>
              <option value="received">Received</option>
            </select>
          </label>
        )}
        {(report === 'ewt-schedule' || report === 'cwt-schedule') && (
          <label className="block">
            <span className={label}>ATC</span>
            <input
              aria-label="ATC"
              placeholder="e.g. WC158"
              value={atc}
              onChange={(e) => setAtc(e.target.value)}
              className={`${input} w-28`}
            />
          </label>
        )}
        {report === 'exceptions' && (
          <>
            <label className="block">
              <span className={label}>Module</span>
              <select
                aria-label="Module"
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className={input}
              >
                <option value="">All modules</option>
                {(Object.keys(EXCEPTION_MODULE_LABEL) as ExceptionModule[]).map((m) => (
                  <option key={m} value={m}>
                    {EXCEPTION_MODULE_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>Exception</span>
              <select
                aria-label="Exception"
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                className={input}
              >
                <option value="">All exceptions</option>
                {(Object.keys(EXCEPTION_KIND_LABEL) as ExceptionKind[]).map((k) => (
                  <option key={k} value={k}>
                    {EXCEPTION_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        {report === 'input-vat' && (
          <label className="block">
            <span className={label}>Project / asset</span>
            <input
              aria-label="Project or asset"
              placeholder="e.g. FA-0007"
              value={projectAssetRef}
              onChange={(e) => setProjectAssetRef(e.target.value)}
              className={`${input} w-36`}
            />
          </label>
        )}
        {report !== 'vat-summary' && report !== 'reconciliation' && (
          <label className="block min-w-[220px] flex-1">
            <span className={label}>Search</span>
            <input
              aria-label="Search"
              placeholder={
                report === 'exceptions'
                  ? 'Document no., party, user, reason…'
                  : 'Document no., party, TIN…'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${input} w-full`}
            />
          </label>
        )}
        <div className="ml-auto pb-0.5">
          <ExportButton
            endpoint={`/reports/tax/${slug[report]}/export`}
            params={query as unknown as Record<string, string | undefined>}
            fallbackFilename={`${slug[report]}-${period.startDate}-to-${period.endDate}.xlsx`}
            disabled={!ready}
          />
        </div>
      </div>

      {!ready ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Pick a period: the start date must be on or before the end date.
        </div>
      ) : (
        <>
          {report === 'vat-summary' && (
            <VatSummaryView query={query} onMeta={setMeta} canClose={canClose} />
          )}
          {report === 'output-vat' && <OutputVatView query={query} onMeta={setMeta} />}
          {report === 'input-vat' && <InputVatView query={query} onMeta={setMeta} />}
          {report === 'ewt-schedule' && (
            <EwtView query={query} onMeta={setMeta} canClose={canClose} />
          )}
          {report === 'cwt-schedule' && <CwtView query={query} onMeta={setMeta} />}
          {report === 'reconciliation' && <ReconciliationView query={query} onMeta={setMeta} />}
          {report === 'exceptions' && (
            <ExceptionsView query={query} onMeta={setMeta} onFilter={cutBy} />
          )}
        </>
      )}
    </div>
  )
}
