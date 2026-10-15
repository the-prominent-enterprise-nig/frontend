import Link from 'next/link'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { PendingDim, UrlFiltersProvider } from '@/src/components/ssr/UrlFilters'
import { RefreshButton } from '@/src/components/ssr/RefreshButton'
import ARInvoicesList from './_components/ARInvoicesList'
import { fetchRollup } from './_landing/data'
import { parseLandingParams } from './_landing/params'
import { LandingFilters } from './_landing/LandingFilters'
import { NewReceiptButton } from './_landing/NewReceiptButton'
import { CustomerRollupTable } from './_landing/CustomerRollupTable'

export const metadata = { title: 'AR Invoices' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; q?: string; page?: string }>
}) {
  const raw = await searchParams

  // A customer filter keeps the invoice-level screen (payments, memos, voids…).
  if (raw.customerId) {
    const session = await getSessionOrNull()
    requirePermission(session, ACCOUNTING_PERMISSIONS.AR_INVOICES_READ)
    return (
      <div className="min-h-screen bg-gray-50">
        <ARInvoicesList initialCustomerId={raw.customerId} />
      </div>
    )
  }

  // The landing: one row per customer, grouped on the server. Start the query
  // before the session check so the two overlap (the backend enforces
  // permissions itself; the redirect below only decides which page is shown).
  const params = parseLandingParams(raw)
  const rollup = fetchRollup(params)
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.AR_INVOICES_READ)

  // No Suspense / loading.tsx on purpose: a ~150 ms query, so the first HTML
  // flush carries the page (see docs/query-optimization-plan.md §7.1).
  const result = await rollup

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">AR Invoices</h2>
            <p className="text-sm text-gray-500">Customer invoices and receivables.</p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton label="Refresh" />
            <Link
              href="/accounting/ar-invoices/retention"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-700 hover:bg-purple-50"
            >
              Customer retention
            </Link>
            <NewReceiptButton />
          </div>
        </div>

        <UrlFiltersProvider>
          <LandingFilters q={params.search} />
          <PendingDim>
            <CustomerRollupTable rollup={result} page={params.page} />
          </PendingDim>
        </UrlFiltersProvider>
      </div>
    </div>
  )
}
