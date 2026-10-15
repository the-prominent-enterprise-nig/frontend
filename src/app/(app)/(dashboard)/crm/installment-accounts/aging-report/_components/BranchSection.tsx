import { Suspense } from 'react'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { SectionError } from '@/src/components/ssr/SectionError'
import {
  AGING_BUCKET_LABELS,
  type AgingReportBranchGroup,
  type AgingReportCollectorGroup,
} from '@/src/schema/crm/types'
import { fetchBranchDetail } from '../_data'
import type { AgingFilters } from '../_params'
import { BUCKET_STYLES, fmt } from '../_format'

/**
 * One branch card. The header comes from the summary the page already has, so
 * it paints at once; the collector tables (the heavy part — every account row)
 * stream in behind their own Suspense boundary, in parallel with the other
 * branches on the page.
 */
export function BranchSection({
  branch,
  filters,
  hasInstallmentRows,
}: {
  branch: AgingReportBranchGroup
  filters: AgingFilters
  hasInstallmentRows: boolean
}): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between bg-gray-100 px-4 py-2">
        <h2 className="text-sm font-semibold uppercase text-gray-700">{branch.branchName}</h2>
        <span className="text-xs text-gray-500">
          {branch.subtotal.count} account{branch.subtotal.count !== 1 ? 's' : ''} · OB{' '}
          {fmt(branch.subtotal.ob)}
        </span>
      </div>
      <Suspense fallback={<BranchRowsSkeleton />}>
        <BranchCollectors
          branchId={branch.branchId}
          filters={filters}
          hasInstallmentRows={hasInstallmentRows}
        />
      </Suspense>
    </div>
  )
}

function BranchRowsSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-2 px-4 py-4" aria-busy aria-label="Loading accounts">
      <Skeleton className="h-4 w-1/2" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  )
}

async function BranchCollectors({
  branchId,
  filters,
  hasInstallmentRows,
}: {
  branchId: string | null
  filters: AgingFilters
  hasInstallmentRows: boolean
}): Promise<React.JSX.Element> {
  const result = await fetchBranchDetail(filters, branchId)
  if (!result.ok) {
    return (
      <div className="p-4">
        <SectionError message={`Could not load this branch's accounts: ${result.error}`} />
      </div>
    )
  }
  if (!result.data) {
    return <p className="px-4 py-3 text-sm text-gray-500">No accounts.</p>
  }

  return (
    <>
      {result.data.collectors.map((collector) => (
        <CollectorTable
          key={collector.collectorId ?? 'unassigned'}
          collector={collector}
          hasInstallmentRows={hasInstallmentRows}
        />
      ))}
    </>
  )
}

const TH = 'px-1.5 py-1.5 whitespace-nowrap'
const TD = 'px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap'

function CollectorTable({
  collector,
  hasInstallmentRows,
}: {
  collector: AgingReportCollectorGroup
  hasInstallmentRows: boolean
}): React.JSX.Element {
  return (
    <div className="border-t border-gray-100">
      <div className="flex items-center justify-between bg-gray-50 px-4 py-1.5">
        <span className="text-xs font-medium text-gray-600">
          Collector: {collector.areaCode ? `${collector.areaCode} - ` : ''}
          {collector.collectorLabel}
          {collector.supervisorName && (
            <span className="ml-2 font-normal text-gray-400">
              Supervisor: {collector.supervisorName}
            </span>
          )}
          {collector.area && (
            <span className="ml-2 font-normal text-gray-400">Area: {collector.area}</span>
          )}
        </span>
        <span className="text-xs text-gray-500">
          {collector.subtotal.count} · TOTAL PAY&apos;T {fmt(collector.subtotal.totalPayt)} · OB{' '}
          {fmt(collector.subtotal.ob)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-left text-[11px] uppercase text-gray-500">
              <th className={TH}>Account</th>
              <th className={TH}>Customer</th>
              <th className={TH}>Source</th>
              <th className={TH}>Aging</th>
              {hasInstallmentRows && (
                <>
                  <th className={TH}>Type</th>
                  <th className={`${TH} text-right`}>Term</th>
                  <th className={`${TH} text-right`}>MI</th>
                  <th className={`${TH} text-right`}>DP Bal</th>
                </>
              )}
              <th className={`${TH} text-right`}>OB</th>
              {hasInstallmentRows && <th className={`${TH} text-right`}>MI DUE</th>}
              <th className={`${TH} text-right`}>NO ARS</th>
              <th className={`${TH} text-right`}>MOS RUN</th>
              <th className={`${TH} text-right`}>NOT MVG</th>
              <th className={`${TH} text-right`}>TOTAL PAY&apos;T</th>
              <th className={`${TH} text-right`}>TOTAL PRICE</th>
              <th className={TH}>Last CR Date</th>
            </tr>
          </thead>
          {collector.categories.map((catGroup) => (
            <tbody key={catGroup.category ?? 'uncategorized'}>
              {/* Matches the legacy sheet's "CATEGORY A" banner — only shown when
                  a collector actually spans more than one category, so a
                  single-category collector's table isn't cluttered with a
                  redundant one-row banner. */}
              {collector.categories.length > 1 && (
                <tr className="bg-prominent-purple-50">
                  <td
                    colSpan={hasInstallmentRows ? 16 : 11}
                    className="px-1.5 py-1 text-[11px] font-semibold uppercase text-prominent-purple-900"
                  >
                    Category {catGroup.category ?? 'Uncategorized'} · {catGroup.subtotal.count}{' '}
                    account{catGroup.subtotal.count !== 1 ? 's' : ''} · OB{' '}
                    {fmt(catGroup.subtotal.ob)}
                  </td>
                </tr>
              )}
              {catGroup.rows.map((row) => (
                <tr key={row.accountId} className="border-b border-gray-100">
                  <td className="px-1.5 py-1.5 font-mono">{row.accountNumber}</td>
                  <td className="px-1.5 py-1.5">{row.customerName}</td>
                  <td className="px-1.5 py-1.5 text-gray-500">
                    {row.source === 'installment' ? 'Installment' : 'Invoice'}
                  </td>
                  <td className="px-1.5 py-1.5 whitespace-nowrap">
                    {row.bucket ? (
                      <>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${BUCKET_STYLES[row.bucket]}`}
                        >
                          {AGING_BUCKET_LABELS[row.bucket]}
                        </span>
                        {row.daysOverdue !== null && row.daysOverdue > 0 && (
                          <span className="ml-1.5 text-gray-500">{row.daysOverdue}d</span>
                        )}
                      </>
                    ) : (
                      // No due date on record — shown as unknown rather than
                      // quietly rendered as current.
                      <span className="text-gray-400">Unknown</span>
                    )}
                  </td>
                  {hasInstallmentRows && (
                    <>
                      <td className="px-1.5 py-1.5">{row.type ?? '—'}</td>
                      <td className={TD}>{row.term ?? '—'}</td>
                      <td className={TD}>{fmt(row.mi)}</td>
                      <td className={TD}>{fmt(row.dpBal)}</td>
                    </>
                  )}
                  <td className={TD}>{fmt(row.ob)}</td>
                  {hasInstallmentRows && <td className={TD}>{fmt(row.miDue)}</td>}
                  <td className={TD}>{row.noArs === null ? '—' : row.noArs}</td>
                  <td className={TD}>{row.mosRun}</td>
                  <td className={TD}>{row.notMvg}</td>
                  <td className={TD}>{fmt(row.totalPayt)}</td>
                  <td className={TD}>{fmt(row.totalPrice)}</td>
                  <td className="px-1.5 py-1.5">{row.lastOrDate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  )
}
