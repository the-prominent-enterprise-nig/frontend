import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, canAny } from '@/src/libs/guards/permission'
import { CRM_PERMISSIONS } from '@/src/libs/guards/crm-permissions'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { PendingDim, UrlFiltersProvider } from '@/src/components/ssr/UrlFilters'
import { fetchAgingSummary, fetchFilterOptions } from './_data'
import { agingFilters, parseAgingParams, type RawSearchParams } from './_params'
import { AgingActions } from './_components/AgingActions'
import { AgingFilterBar } from './_components/AgingFilterBar'
import { AgingReportBody } from './_components/AgingReportBody'
import {
  ActionsSkeleton,
  AgingHeading,
  FilterBarSkeleton,
  ReportSkeleton,
} from './_components/AgingSkeleton'

export const metadata = { title: 'AR Aging Report | CRM' }

export default async function AgingReportPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const params = parseAgingParams(await searchParams)
  const filters = agingFilters(params)

  // Start the backend calls before checking the session so they overlap with it.
  // They never reject, and the backend enforces permissions on every call itself
  // — the redirects below only decide which page the user sees.
  const summary = fetchAgingSummary(filters)
  const options = fetchFilterOptions()

  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  // Matches the backend route's OR permission (installment-account.controller.ts)
  // — Accountant holds only accounting:*, no crm:* at all, but this report is
  // exactly what they need, so either permission is accepted here too.
  const allowed =
    can(session, CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_READ) ||
    can(session, ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ)
  if (!allowed) redirect('/403')

  return (
    <div className="px-3 py-5 sm:px-4 lg:px-6 lg:py-6">
      <UrlFiltersProvider>
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <AgingHeading />
          <Suspense fallback={<ActionsSkeleton />}>
            <AgingActions
              summary={summary}
              filters={filters}
              canLoad={canAny(session, [
                CRM_PERMISSIONS.INSTALLMENT_ACCOUNTS_CREATE,
                ACCOUNTING_PERMISSIONS.AR_INVOICES_CREATE,
              ])}
            />
          </Suspense>
        </header>

        <Suspense fallback={<FilterBarSkeleton />}>
          <AgingFilterBar options={options} values={filters} />
        </Suspense>

        <PendingDim>
          <Suspense fallback={<ReportSkeleton />}>
            <AgingReportBody summary={summary} params={params} />
          </Suspense>
        </PendingDim>
      </UrlFiltersProvider>
    </div>
  )
}
