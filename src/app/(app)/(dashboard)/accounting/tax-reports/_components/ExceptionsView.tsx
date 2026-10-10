'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import {
  TaxReports,
  type ExceptionRow,
  type TaxReportMeta,
  type TaxReportQuery,
} from '@/src/libs/data/TaxReportsData'
import {
  EXCEPTION_KIND_LABEL,
  EXCEPTION_KIND_TONE,
  EXCEPTION_MODULE_LABEL,
  documentHref,
} from '@/src/libs/tax/tax-reports'
import { OVERRIDE_FIELD_LABEL } from '@/src/libs/tax/tax-override'
import { Chip, EmptyRow, HEAD, Money, StatCard, TH, THR, TableShell, useTaxReport } from './ui'

// Tax Code Exception Report — what a reviewer should look at before the month is
// closed: tax codes that were changed away from their defaults (with the reason,
// who and when), and the codes that are missing where one is expected. Where the
// other tax reports read the ledger, this one reads the documents: what it looks
// for is a decision somebody made, or did not.
export default function ExceptionsView({
  query,
  onMeta,
  onFilter,
}: {
  query: TaxReportQuery
  onMeta: (m: TaxReportMeta | null) => void
  /** Cuts the report by something clicked in the summary. */
  onFilter: (patch: { kind?: string; module?: string; userId?: string }) => void
}) {
  const { data, loading, error } = useTaxReport(TaxReports.exceptions, query)
  useEffect(() => onMeta(data?.meta ?? null), [data, onMeta])

  const kindCount = (k: string) => data?.summary.byKind.find((x) => x.kind === k)?.count ?? 0
  const missing =
    kindCount('NO_VAT_CLASS') + kindCount('NO_INPUT_CODE') + kindCount('NO_WITHHOLDING_CODE')
  const activeUser = data?.summary.byUser.find((u) => u.userId && u.userId === query.userId)
  // the counts are those of the rows below, so a cut by something says so
  const narrowed = !!(query.kind || query.module || query.userId || query.search)

  const hrefOf = (r: ExceptionRow): string | null =>
    r.module === 'POS'
      ? r.documentNo
        ? `/pos/transactions?search=${encodeURIComponent(r.documentNo)}`
        : null
      : documentHref(r.documentType, r.documentId)

  return (
    <div>
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {data && data.codesWithoutAtc.length > 0 && (
        <div
          data-testid="exceptions-atc-note"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"
        >
          <div className="font-medium">
            {data.codesWithoutAtc.length} withholding tax{' '}
            {data.codesWithoutAtc.length === 1 ? 'code has' : 'codes have'} no ATC yet.
          </div>
          <p className="mt-0.5">
            The ATC list has to come from NIG&rsquo;s accountant; the BIR-facing schedules are not
            ready for filing until it is in. Add each one under Tax Codes.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2" data-testid="exceptions-atc-codes">
            {data.codesWithoutAtc.map((c) => (
              <li
                key={c.code}
                title={c.name}
                className="rounded border border-amber-200 bg-white px-2 py-1 text-xs"
              >
                <span className="font-mono font-semibold">{c.code}</span>
                {c.uses !== null && (
                  <span className="ml-2 text-gray-600">
                    {c.uses} {c.uses === 1 ? 'document' : 'documents'}
                    {c.withheld ? (
                      <>
                        {' '}
                        · <Money value={c.withheld} />
                      </>
                    ) : null}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          testId="stat-exceptions"
          label={narrowed ? 'Exceptions matching the filters' : 'Exceptions in the period'}
          value={data ? data.totals.rows : '—'}
          hint={data ? `on ${data.totals.documents} documents` : undefined}
          tone={data && data.totals.rows > 0 ? 'amber' : 'green'}
        />
        <StatCard
          testId="stat-changed"
          label="Tax codes changed"
          value={data ? kindCount('OVERRIDE') : '—'}
          hint="with a reason, kept on the document"
        />
        <StatCard
          testId="stat-missing"
          label="Codes missing"
          value={data ? missing : '—'}
          hint="where one is expected"
          tone={missing > 0 ? 'red' : 'gray'}
        />
        <StatCard
          testId="stat-no-atc"
          label="Withholding codes with no ATC"
          value={data ? data.codesWithoutAtc.length : '—'}
          tone={data && data.codesWithoutAtc.length > 0 ? 'amber' : 'gray'}
        />
      </div>

      {data && data.rows.length > 0 && (
        <div className="mb-4 grid gap-3 lg:grid-cols-3" data-testid="exceptions-summary">
          <SummaryList
            title="By exception"
            testId="exceptions-by-kind"
            items={data.summary.byKind
              .filter((k) => k.count > 0)
              .map((k) => ({
                key: k.kind,
                label: EXCEPTION_KIND_LABEL[k.kind],
                count: k.count,
                active: query.kind === k.kind,
                pick: () => onFilter({ kind: query.kind === k.kind ? '' : k.kind }),
              }))}
          />
          <SummaryList
            title="By module"
            testId="exceptions-by-module"
            items={data.summary.byModule
              .filter((m) => m.count > 0)
              .map((m) => ({
                key: m.module,
                label: EXCEPTION_MODULE_LABEL[m.module],
                count: m.count,
                active: query.module === m.module,
                pick: () => onFilter({ module: query.module === m.module ? '' : m.module }),
              }))}
          />
          <SummaryList
            title="By user"
            testId="exceptions-by-user"
            items={data.summary.byUser.map((u) => ({
              key: u.userId ?? 'none',
              label: u.userName,
              count: u.count,
              active: !!u.userId && query.userId === u.userId,
              pick: u.userId
                ? () => onFilter({ userId: query.userId === u.userId ? '' : u.userId! })
                : undefined,
            }))}
          />
        </div>
      )}

      {query.userId && (
        <div className="mb-3 text-sm text-gray-700" data-testid="exceptions-user-filter">
          Showing {activeUser?.userName ?? 'one user'} only.{' '}
          <button
            type="button"
            className="font-medium text-purple-700 hover:underline"
            onClick={() => onFilter({ userId: '' })}
          >
            Show everyone
          </button>
        </div>
      )}

      <TableShell testId="exceptions-table">
        <thead className={HEAD}>
          <tr>
            <th className={TH}>Date</th>
            <th className={TH}>Document</th>
            <th className={TH}>Customer / supplier</th>
            <th className={TH}>Branch</th>
            <th className={TH}>Exception</th>
            <th className={TH}>What</th>
            <th className={TH}>Reason</th>
            <th className={TH}>User</th>
            <th className={THR}>Document total</th>
          </tr>
        </thead>
        <tbody>
          {!data || data.rows.length === 0 ? (
            <EmptyRow
              cols={9}
              loading={loading}
              text="No exceptions in this period: every code is where it should be."
            />
          ) : (
            data.rows.map((r, i) => {
              const href = hrefOf(r)
              return (
                <tr
                  key={`${r.kind}-${r.documentId}-${r.line ?? 'doc'}-${i}`}
                  data-testid="exception-row"
                  className="border-t border-gray-100 align-top"
                >
                  <td className="whitespace-nowrap px-3 py-2">{r.date}</td>
                  <td className="px-3 py-2">
                    {r.documentNo ? (
                      href ? (
                        <Link
                          href={href}
                          className="whitespace-nowrap font-medium text-purple-700 hover:underline"
                        >
                          {r.documentNo}
                        </Link>
                      ) : (
                        <span className="whitespace-nowrap font-medium">{r.documentNo}</span>
                      )
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                    <div className="text-[11px] text-gray-500">{r.documentType}</div>
                  </td>
                  <td className="px-3 py-2">
                    {r.party ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{r.branchName}</td>
                  <td className="px-3 py-2">
                    <Chip tone={EXCEPTION_KIND_TONE[r.kind]}>{EXCEPTION_KIND_LABEL[r.kind]}</Chip>
                  </td>
                  <td className="px-3 py-2">
                    {r.kind === 'OVERRIDE' ? (
                      <div>
                        <div className="text-[11px] text-gray-500">
                          {r.field ? OVERRIDE_FIELD_LABEL[r.field] : ''}
                          {r.line !== null ? ` · line ${r.line}` : ''}
                        </div>
                        <div className="font-mono text-xs">
                          {r.defaultCode ?? '—'} <span className="text-gray-400">→</span>{' '}
                          <span className="font-semibold">{r.chosenCode ?? '—'}</span>
                        </div>
                      </div>
                    ) : (
                      r.detail
                    )}
                  </td>
                  <td className="max-w-65 px-3 py-2">
                    {r.reason ?? <span className="text-gray-300">—</span>}
                    {r.approvedByName && (
                      <div className="text-[11px] text-gray-500">
                        approved by {r.approvedByName}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {r.userName ?? <span className="text-gray-300">—</span>}
                    {r.at && (
                      <div className="text-[11px] text-gray-500">
                        {new Date(r.at).toLocaleDateString('en-PH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Money value={r.amount} zeroAsDash />
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </TableShell>
    </div>
  )
}

function SummaryList({
  title,
  testId,
  items,
}: {
  title: string
  testId: string
  items: { key: string; label: string; count: number; active: boolean; pick?: () => void }[]
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3" data-testid={testId}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h2>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.key}>
            {it.pick ? (
              <button
                type="button"
                onClick={it.pick}
                aria-pressed={it.active}
                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-purple-50 ${
                  it.active ? 'bg-purple-50 font-semibold text-purple-800' : 'text-gray-700'
                }`}
              >
                <span>{it.label}</span>
                <span className="tabular-nums">{it.count}</span>
              </button>
            ) : (
              <div className="flex items-center justify-between px-2 py-1 text-sm text-gray-500">
                <span>{it.label}</span>
                <span className="tabular-nums">{it.count}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
