'use client'

import { useQuery } from '@tanstack/react-query'
import { getSerialNumbers } from '../../../serial-numbers/_actions/get-serial-numbers'

export type ReplacementUnit = { id: string; serialNumber: string }

/**
 * The units this branch could hand over in place of the one coming back.
 *
 * Fetched per expanded row rather than once per page: the old screen loaded
 * 500 in-stock serials on every visit to the list, for a picker that did not
 * exist yet, and its own comment noted the list "by definition never contains
 * the unit being returned".
 *
 * Only asked for serial-tracked items. An untracked item swaps by quantity —
 * there is no named unit to pick, and the server refuses one if you send it.
 */
export function useReplacementUnits(params: {
  itemId: string
  warehouseId: string
  /** The unit coming back — it cannot also be the one going out. */
  returnedSerialNumberId?: string
  serialTracked: boolean
  enabled: boolean
}): { units: ReplacementUnit[]; isLoading: boolean } {
  const { itemId, warehouseId, returnedSerialNumberId, serialTracked, enabled } = params

  const query = useQuery({
    queryKey: ['return-replacement-serials', itemId, warehouseId],
    queryFn: () => getSerialNumbers({ itemId, warehouseId, status: 'in_stock', limit: 100 }),
    enabled: enabled && serialTracked && !!itemId && !!warehouseId,
    staleTime: 60 * 1000,
  })

  const units = (query.data?.data?.data ?? [])
    .filter((s) => s.id !== returnedSerialNumberId)
    .map((s) => ({ id: s.id, serialNumber: s.serialNumber }))

  return { units, isLoading: query.isLoading && query.isFetching }
}
