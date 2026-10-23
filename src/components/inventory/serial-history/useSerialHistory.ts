'use client'

import { useQuery } from '@tanstack/react-query'
import { STALE } from '@/src/libs/query/stale-times'
import { getSerialMovements } from '@/src/app/(app)/(dashboard)/inventory/serial-numbers/_actions/get-serial-movements'
import type {
  SerialHistoryHeader,
  SerialMovementEntry,
} from '@/src/schema/inventory/serial-numbers'

type SerialHistory = {
  header: SerialHistoryHeader | null
  entries: SerialMovementEntry[]
  isLoading: boolean
  /** Set when the request failed — kept apart from an empty timeline so a
   *  404 (a unit outside the caller's branch) never reads as "no history". */
  error: string | null
}

export function useSerialHistory(serialId: string): SerialHistory {
  const query = useQuery({
    queryKey: ['inventory-serial-movements', serialId],
    queryFn: () => getSerialMovements(serialId),
    staleTime: STALE.OPERATIONAL,
    enabled: !!serialId,
  })

  const result = query.data
  const failed = query.isError || (result !== undefined && !result.success)

  return {
    header: result?.success ? (result.data?.serial ?? null) : null,
    entries: result?.success ? (result.data?.data ?? []) : [],
    isLoading: query.isLoading,
    error: failed ? (result?.message ?? result?.error ?? 'Request failed') : null,
  }
}
