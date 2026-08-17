import { getWarehouses } from '@/src/app/(app)/(dashboard)/inventory/warehouses/_actions/get-warehouses'

/**
 * Several inventory endpoints (reorder alerts, valuation report) only
 * accept warehouseId, not branchId, as a filter — Warehouse.branchId exists
 * on each record, but the list endpoint itself has no branchId query param.
 * Resolves client-side instead: fetch warehouses, keep the ones belonging
 * to the given branch. Usually resolves to one warehouse, but a branch can
 * have more than one.
 */
export async function resolveBranchWarehouseIds(branchId: string): Promise<string[]> {
  const res = await getWarehouses({ limit: 200 })
  const warehouses = res.data?.data ?? []
  return warehouses.filter((w) => w.branchId === branchId).map((w) => w.id)
}
