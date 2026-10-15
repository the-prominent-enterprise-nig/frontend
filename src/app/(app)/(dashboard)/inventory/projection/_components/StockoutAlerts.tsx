import { AlertTriangle } from 'lucide-react'
import type { Settled } from '@/src/libs/api/unwrap'
import type { StockoutAlert } from '@/src/schema/inventory/projection'
import { SectionError } from '@/src/components/ssr/SectionError'

const MS_PER_DAY = 86_400_000

function daysUntil(isoDate: string): number {
  return Math.ceil((new Date(isoDate).getTime() - Date.now()) / MS_PER_DAY)
}

export async function StockoutAlerts({
  alerts,
}: {
  alerts: Promise<Settled<StockoutAlert[]>>
}): Promise<React.JSX.Element | null> {
  const result = await alerts
  if (!result.ok)
    return <SectionError message={`Could not load stockout alerts: ${result.error}`} />
  if (result.data.length === 0) return null

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-500" />
        <h2 className="text-sm font-semibold text-red-800">
          Stockout Alerts ({result.data.length})
        </h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {result.data.map((alert, index) => {
          const days = alert.stockoutDate ? daysUntil(alert.stockoutDate) : null
          return (
            <div
              key={`${alert.itemId}-${alert.warehouseId ?? index}`}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 shadow-sm"
            >
              <span className="text-sm font-medium text-zinc-900">
                {alert.name ?? alert.itemId}
              </span>
              {alert.warehouseName && (
                <span className="text-xs text-zinc-400">@ {alert.warehouseName}</span>
              )}
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {days != null ? `Stockout in ${days} day${days === 1 ? '' : 's'}` : 'Stockout risk'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
