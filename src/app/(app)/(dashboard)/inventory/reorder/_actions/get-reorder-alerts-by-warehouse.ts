'use server'

import { api } from '@/src/libs/api/client'

export type ReorderAlertByWarehouse = {
  ruleId: string
  itemId: string
  sku: string
  itemName: string
  warehouseId: string | null
  warehouseName: string | null
  alertType: 'below_min' | 'above_max' | 'reorder'
  threshold: number
  currentQty: number
}

// Deliberately separate from get-reorder-alerts.ts's getReorderAlerts(),
// which hits /inventory/stock/reorder-alerts (no query params at all,
// hardcoded server-side to the caller's own branch) and is shared with the
// real Inventory dashboard page — changing its target endpoint would affect
// that page too. This hits the other, warehouse-filterable reorder-alerts
// endpoint instead, so the main dashboard's branch switcher can ask for a
// specific branch's alerts without touching the existing shared action.
export async function getReorderAlertsByWarehouse(warehouseId?: string) {
  return api.get<ReorderAlertByWarehouse[]>('/inventory/reorder/alerts', {
    warehouseId,
  })
}
