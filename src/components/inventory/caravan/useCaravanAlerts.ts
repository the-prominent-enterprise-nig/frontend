'use client'

import { useQuery } from '@tanstack/react-query'
import { getCaravanAlerts } from '@/src/app/(app)/(dashboard)/inventory/transfers/_actions/get-caravan-alerts'
import type { CaravanAlert } from '@/src/schema/inventory/warehouses'

/** Scenario 60 Part 3 — shared by the Caravan tab, the Transfers banner and
 * the POS notice, so all three read one cached list per host branch. */
export function useCaravanAlerts(
  hostBranchId?: string | null,
  enabled = true,
  // The Caravan tab also lists caravans that have ended and been emptied.
  includeEnded = false
): { alerts: CaravanAlert[]; isLoading: boolean } {
  const query = useQuery({
    queryKey: ['caravan-alerts', hostBranchId ?? null, includeEnded],
    queryFn: () => getCaravanAlerts(hostBranchId ?? undefined, includeEnded),
    enabled,
    staleTime: 60 * 1000,
  })
  return { alerts: query.data?.data ?? [], isLoading: query.isLoading }
}
