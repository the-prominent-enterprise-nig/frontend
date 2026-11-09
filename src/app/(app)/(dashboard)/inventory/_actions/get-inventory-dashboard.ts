'use server'

import { getSessionOrNull } from '@/src/libs/auth/actions'
import { getItems } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-items'
import { getValuationReport } from '@/src/app/(app)/(dashboard)/inventory/reports/_actions/get-valuation-report'
import { getTurnoverReport } from '@/src/app/(app)/(dashboard)/inventory/reports/_actions/get-turnover-report'
import { getAgingUnitCounts } from '@/src/app/(app)/(dashboard)/inventory/reports/_actions/get-aging-unit-counts'
import { getTransfers } from '@/src/app/(app)/(dashboard)/inventory/transfers/_actions/get-transfers'
import { getStockoutAlerts } from '@/src/app/(app)/(dashboard)/inventory/projection/_actions/get-stockout-alerts'
import { getExpiringBatches } from '@/src/app/(app)/(dashboard)/inventory/batches/_actions/get-batches'
import { getStockBalances } from '@/src/app/(app)/(dashboard)/inventory/stock/_actions/get-stock-balances'
import { getWarehouses } from '@/src/app/(app)/(dashboard)/inventory/warehouses/_actions/get-warehouses'
import { getReservations } from '@/src/app/(app)/(dashboard)/inventory/reservations/_actions/get-reservations'
import { getNegativeStockViolations } from '@/src/app/(app)/(dashboard)/inventory/negative-stock/_actions/get-negative-stock-violations'
import { getActionQueue } from '@/src/app/(app)/(dashboard)/inventory/_actions/get-action-queue'
import { getReturns } from '@/src/app/(app)/(dashboard)/inventory/returns/_actions/get-returns'
import { getPurchaseRequests } from '@/src/app/(app)/(dashboard)/inventory/purchase-requests/_actions/get-purchase-requests'
import { getPurchaseOrders } from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_actions/get-purchase-orders'

/** One dashboard read: the action's own result, or null when the call itself threw. */
export type InventoryDashboardRead = { success?: boolean; data?: unknown } | null

/**
 * Every read the Inventory dashboard shows, in one Server Action.
 *
 * The page used to call these sixteen actions from the browser in a
 * `Promise.allSettled`, but Next runs Server Actions one at a time per client
 * (they are queued, not concurrent), so the sixteen ran back to back: the
 * dashboard's last number landed ~1.4 s in, and again on every 30 s refresh.
 * Called from here they run in parallel on the server, next to the backend,
 * and the browser makes a single round trip. Each action still does its own
 * trimming (only the pre-aggregated summaries, bounded lists), so the payload
 * is the same as the sixteen responses added together.
 *
 * The result is in the order of the list below, which the page indexes by
 * position. A read that throws comes back null — the same as the rejected
 * entry of the `allSettled` it replaces — so one failing card leaves the rest.
 */
export async function getInventoryDashboard(): Promise<InventoryDashboardRead[]> {
  // Amounts stay with Head Office: a branch user's dashboard never fetches
  // valuation, so no peso figure reaches their browser (the page shows units).
  const session = await getSessionOrNull()
  const headOffice = !session?.branchId
  const reads: Promise<InventoryDashboardRead>[] = [
    getItems({ limit: 1 }), // 0
    headOffice ? getValuationReport({ limit: 1 }) : Promise.resolve(null), // 1 — only the pre-aggregated `summary` is used, not `data`
    getTurnoverReport({ periodDays: 90 }), // 2
    getTransfers({ limit: 20 }), // 3
    getStockoutAlerts({ days: 30 }), // 4
    getExpiringBatches({ days: 30, limit: 20 }), // 5
    getStockBalances({ limit: 1 }), // 6 — only the pre-aggregated `summary` is used, not `data`
    getWarehouses({ status: 'active', limit: 50 }), // 7
    getReservations({ limit: 1 }), // 8 — only the pre-aggregated `summary` is used, not `data`
    getNegativeStockViolations({ limit: 50 }), // 9
    getActionQueue(), // 10 — open transfers/PRs/POs; the page keeps the ones waiting on the viewer
    getReturns({ limit: 20 }), // 11
    getAgingUnitCounts(), // 12 — bucket counts only, no cost, so roles without item cost get it too
    getPurchaseRequests({ limit: 50 }), // 13
    getPurchaseOrders({ limit: 50 }), // 14
  ]
  return Promise.all(reads.map((read) => read.catch(() => null)))
}
