'use client'

import { useQuery } from '@tanstack/react-query'
import { getSerialNumbers } from '../../../serial-numbers/_actions/get-serial-numbers'

export type ReplacementUnit = { id: string; serialNumber: string }

/**
 * How many units this branch could hand over in place of the one coming back,
 * and the search the picker uses to choose one.
 *
 * Fetched per expanded row rather than once per page. The picker itself asks
 * the server as you type (see `searchReplacementUnits`): this used to load the
 * first 100 in-stock units and offer only those, so a branch holding more than
 * 100 of an item (30 item/location pairs already do) could not pick the rest.
 *
 * Only asked for serial-tracked items. An untracked item swaps by quantity —
 * there is no named unit to pick, and the server refuses one if you send it.
 */
export function useReplacementUnits(params: {
  itemId: string
  warehouseId: string
  serialTracked: boolean
  enabled: boolean
}): { count: number | undefined; isLoading: boolean } {
  const { itemId, warehouseId, serialTracked, enabled } = params

  const query = useQuery({
    queryKey: ['return-replacement-serials', itemId, warehouseId],
    // One row is enough: only the envelope's total is read.
    queryFn: () => getSerialNumbers({ itemId, warehouseId, status: 'in_stock', limit: 1 }),
    enabled: enabled && serialTracked && !!itemId && !!warehouseId,
    staleTime: 60 * 1000,
  })

  const total = query.data?.data?.total
  const rows = query.data?.data?.data
  return {
    count: query.data ? (total ?? rows?.length ?? 0) : undefined,
    isLoading: query.isLoading && query.isFetching,
  }
}

/** In-stock units here matching what was typed — asked of the server, so any
 * unit can be found, not just the first page. */
export async function searchReplacementUnits(
  params: { itemId: string; warehouseId: string; returnedSerialNumberId?: string },
  query: string
): Promise<ReplacementUnit[]> {
  const res = await getSerialNumbers({
    itemId: params.itemId,
    warehouseId: params.warehouseId,
    status: 'in_stock',
    search: query.trim() || undefined,
    limit: 30,
  })
  return (res.data?.data ?? [])
    .filter((s) => s.id !== params.returnedSerialNumberId)
    .map((s) => ({ id: s.id, serialNumber: s.serialNumber }))
}
