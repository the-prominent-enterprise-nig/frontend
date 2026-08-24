'use client'

import { useQuery } from '@tanstack/react-query'
import { STALE } from '@/src/libs/query/stale-times'
import { getSerialMovements } from '@/src/app/(app)/(dashboard)/inventory/serial-numbers/_actions/get-serial-movements'

export function useSerialMovements(serialId: string | null) {
  const movementsQuery = useQuery({
    queryKey: ['inventory-serial-movements', serialId],
    queryFn: () => getSerialMovements(serialId!),
    staleTime: STALE.OPERATIONAL,
    enabled: !!serialId,
  })

  const movements = movementsQuery.data?.success ? (movementsQuery.data.data?.data ?? []) : []

  return { movements, isLoading: movementsQuery.isLoading }
}
