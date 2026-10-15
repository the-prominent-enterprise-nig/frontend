import { TrendingUp } from 'lucide-react'
import type { Settled } from '@/src/libs/api/unwrap'
import type { ProjectionSummaryResponse } from '@/src/schema/inventory/projection'
import { SectionError } from '@/src/components/ssr/SectionError'
import { UrlPagination } from '@/src/components/ssr/UrlPagination'
import { fixedPages } from '@/src/components/ssr/paginate'
import { PER_PAGE } from '../_params'

function projectedAvailableColor(qty: number): string {
  if (qty <= 0) return 'text-red-600 font-semibold'
  if (qty < 10) return 'text-amber-600 font-semibold'
  return 'text-green-600'
}

function formatDate(iso: string): string {
  // Date-only strings parse as UTC midnight; format in UTC so the day shown
  // does not depend on the server's time zone.
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

const HEAD = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500'

/**
 * Server Component: the rows are rendered into the HTML and ship no JavaScript.
 * Only the pager (a small client island) is interactive.
 */
export async function ProjectionTable({
  projection,
  page,
}: {
  projection: Promise<Settled<ProjectionSummaryResponse>>
  page: number
}): Promise<React.JSX.Element> {
  const result = await projection
  if (!result.ok) return <SectionError message={`Could not load the projection: ${result.error}`} />

  const { items } = result.data
  const total = result.data.total ?? items.length

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16 shadow-sm">
        <TrendingUp className="mb-3 h-10 w-10 text-zinc-300" />
        <p className="text-sm font-medium text-zinc-500">No projection data available</p>
        <p className="mt-1 text-xs text-zinc-400">
          Adjust filters or check that items have supply/demand data.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className={`${HEAD} text-left`}>Item</th>
                <th className={`${HEAD} hidden text-left sm:table-cell`}>SKU</th>
                <th className={`${HEAD} hidden text-left md:table-cell`}>Location</th>
                <th className={`${HEAD} text-right`}>On Hand</th>
                <th className={`${HEAD} hidden text-right lg:table-cell`}>Incoming</th>
                <th className={`${HEAD} hidden text-right lg:table-cell`}>Reserved</th>
                <th className={`${HEAD} text-right`}>Min Projected Bal.</th>
                <th className={`${HEAD} hidden text-left md:table-cell`}>Stockout Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((item, index) => (
                <tr
                  key={`${item.itemId}-${item.warehouseId ?? index}`}
                  className="hover:bg-zinc-50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{item.name ?? item.itemId}</p>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">
                      {item.sku ?? '—'}
                    </code>
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-600 md:table-cell">
                    {item.warehouseName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700">{item.startQty}</td>
                  <td className="hidden px-4 py-3 text-right text-zinc-700 lg:table-cell">
                    {item.incomingQty}
                  </td>
                  <td className="hidden px-4 py-3 text-right text-zinc-700 lg:table-cell">
                    {item.activeReservations}
                  </td>
                  <td
                    className={`px-4 py-3 text-right ${projectedAvailableColor(item.projectedMinBalance)}`}
                  >
                    {item.projectedMinBalance}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-600 md:table-cell">
                    {item.stockoutDate ? (
                      <span className="text-red-600">{formatDate(item.stockoutDate)}</span>
                    ) : (
                      <span className="text-zinc-400">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <UrlPagination info={fixedPages(page, PER_PAGE, total)} noun="item" />
    </div>
  )
}
