'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, AlertOctagon, CheckCircle } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { getReorderAlerts } from '@/src/app/(app)/(dashboard)/inventory/reorder/_actions/get-reorder-alerts'
import { getReorderAlertsByWarehouse } from '@/src/app/(app)/(dashboard)/inventory/reorder/_actions/get-reorder-alerts-by-warehouse'
import { ARInvoices } from '@/src/libs/data/AccountingV2Data'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { resolveBranchWarehouseIds } from '../resolveBranchWarehouses'

type Alert = {
  type: 'error' | 'warning' | 'success'
  icon: typeof AlertTriangle
  title: string
  body: string
}

const STYLE: Record<Alert['type'], string> = {
  error: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

/**
 * "All Branches" uses the tenant-wide reorder-alerts endpoint as before. A
 * specific branch has no direct filter on it, so it's resolved to that
 * branch's warehouse(s) first, then each is queried individually (via the
 * other, warehouse-filterable reorder endpoint) and combined — same pattern
 * ModulesWidget's loadInventoryStats() already uses, just returning the raw
 * items here instead of a count, since this widget needs to split them into
 * out-of-stock vs low-stock itself.
 */
async function loadReorderAlertItems(branchId: string | null): Promise<{ currentQty: number }[]> {
  if (!branchId) {
    const res = await getReorderAlerts({ limit: 200 })
    const data = res.data as { data?: { currentQty?: number }[] } | undefined
    return (data?.data ?? []).map((a) => ({ currentQty: a.currentQty ?? 0 }))
  }

  const warehouseIds = await resolveBranchWarehouseIds(branchId)
  if (warehouseIds.length === 0) return []

  const perWarehouse = await Promise.all(warehouseIds.map((id) => getReorderAlertsByWarehouse(id)))
  return perWarehouse.flatMap((res) => res.data ?? [])
}

// Real replacement for the old hardcoded ALERTS array — this app has no
// stored "alert" model, so this synthesizes conditions from data that
// already exists elsewhere (same reorder-alerts + AR-invoices sources
// Module Stats/Modules already use). Falls back to a genuine "all clear"
// state rather than always showing 3 items regardless of reality.
//
// Only the low-stock/out-of-stock half reacts to the branch switcher — AR
// invoices have no branch dimension in the data model at all, so the
// overdue-invoice count always stays tenant-wide.
export default function SystemAlertsWidget() {
  const { variant } = useWidgetSize()
  const showBody = variant === 'lg' || variant === 'md'
  const limit = variant === 'xs' ? 2 : 3
  const branchId = usePosBranchContext((s) => s.branchId)

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadReorderAlertItems(branchId), ARInvoices.list()]).then(([alertList, arRes]) => {
      if (cancelled) return

      const outOfStockCount = alertList.filter((a) => a.currentQty === 0).length
      const lowStockCount = alertList.length - outOfStockCount

      const invoices = arRes.data?.items ?? []
      const overdueCount = invoices.filter((i) => i.status === 'OVERDUE').length

      const computed: Alert[] = []
      if (outOfStockCount > 0) {
        computed.push({
          type: 'error',
          icon: AlertOctagon,
          title: `${outOfStockCount} item${outOfStockCount === 1 ? '' : 's'} out of stock`,
          body: 'Zero on-hand quantity against an active reorder rule',
        })
      }
      if (lowStockCount > 0) {
        computed.push({
          type: 'warning',
          icon: AlertTriangle,
          title: `${lowStockCount} item${lowStockCount === 1 ? '' : 's'} below reorder point`,
          body: 'Stock has fallen under its configured minimum level',
        })
      }
      if (overdueCount > 0) {
        computed.push({
          type: 'warning',
          icon: AlertTriangle,
          title: `${overdueCount} invoice${overdueCount === 1 ? '' : 's'} overdue`,
          body: 'Past due date with an outstanding balance',
        })
      }
      if (computed.length === 0) {
        computed.push({
          type: 'success',
          icon: CheckCircle,
          title: 'All systems normal',
          body: 'No stock or invoice alerts right now',
        })
      }

      setAlerts(computed)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [branchId])

  if (loading) {
    return (
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-zinc-100 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {alerts.slice(0, limit).map((alert, i) => {
        const Icon = alert.icon
        return (
          <div
            key={i}
            className={`flex items-start gap-2 rounded-lg border p-2 ${STYLE[alert.type]}`}
          >
            <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{alert.title}</p>
              {showBody && (
                <p className="text-[10px] opacity-80 mt-0.5 line-clamp-1">{alert.body}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
