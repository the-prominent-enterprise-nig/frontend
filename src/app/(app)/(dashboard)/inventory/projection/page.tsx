import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { PendingDim, UrlFiltersProvider } from '@/src/components/ssr/UrlFilters'
import { RefreshButton } from '@/src/components/ssr/RefreshButton'
import { fetchProjection, fetchStockoutAlerts } from './_data'
import { parseProjectionParams, type RawSearchParams } from './_params'
import { DaysHorizon } from './_components/DaysHorizon'
import { ProjectionStats } from './_components/ProjectionStats'
import { StockoutAlerts } from './_components/StockoutAlerts'
import { ProjectionTable } from './_components/ProjectionTable'

export const metadata = {
  title: 'Stock Projection | NIG Central',
  description: 'View forward stock projections based on demand and supply schedules',
}

export default async function ProjectionPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const params = parseProjectionParams(await searchParams)

  // Start both backend calls before checking the session so they run in
  // parallel with it instead of after it. They never reject, and the backend
  // enforces permissions on every call itself — the redirects below only decide
  // which page the user sees.
  const projection = fetchProjection(params)
  const alerts = fetchStockoutAlerts(params)

  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, INVENTORY_PERMISSIONS.PROJECTION_READ)) redirect('/403')

  // No Suspense / loading.tsx on purpose: both calls finish in a few hundred ms,
  // and React holds back the reveal of Suspense content for ~300 ms after
  // showing a fallback — slower than waiting. The first HTML flush carries the
  // whole page, and nothing jumps when data arrives. Use Suspense for sections
  // that are genuinely slow (see the aging report).
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="w-full min-h-full bg-zinc-50 p-4 md:p-6 lg:p-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-prominent-purple-900 md:text-3xl">
                Stock Projection
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                View forward stock projections based on demand and supply schedules.
              </p>
            </div>
            <RefreshButton label="Refresh" showLabelOnMobile={false} />
          </div>

          <UrlFiltersProvider>
            <ProjectionStats projection={projection} alerts={alerts} />
            <DaysHorizon days={params.days} />
            <StockoutAlerts alerts={alerts} />
            <PendingDim>
              <ProjectionTable projection={projection} page={params.page} />
            </PendingDim>
          </UrlFiltersProvider>
        </div>
      </div>
    </div>
  )
}
