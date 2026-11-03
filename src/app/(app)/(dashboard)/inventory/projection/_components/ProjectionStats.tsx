import { AlertTriangle, TrendingUp } from 'lucide-react'
import type { Settled } from '@/src/libs/api/unwrap'
import type { ProjectionSummaryResponse, StockoutAlert } from '@/src/schema/inventory/projection'

interface Props {
  projection: Promise<Settled<ProjectionSummaryResponse>>
  alerts: Promise<Settled<StockoutAlert[]>>
}

/** The two headline chips. Server Component: streams in when both calls are done. */
export async function ProjectionStats({ projection, alerts }: Props): Promise<React.JSX.Element> {
  const [projected, atRisk] = await Promise.all([projection, alerts])
  const itemCount = projected.ok ? (projected.data.total ?? projected.data.items.length) : null
  const alertCount = atRisk.ok ? atRisk.data.length : null

  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
        <TrendingUp className="h-4 w-4 text-prominent-purple-600" />
        <span className="text-sm text-zinc-500">Items Projected:</span>
        <span className="text-sm font-semibold text-zinc-900">
          {itemCount === null ? '—' : itemCount.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 shadow-sm">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <span className="text-sm text-red-700">Stockout Risk:</span>
        <span className="text-sm font-semibold text-red-800">
          {alertCount === null ? '—' : alertCount}
        </span>
      </div>
    </div>
  )
}
