'use client'

import { useQuery } from '@tanstack/react-query'
import { getUoms } from '../../uom/_actions/get-uoms'

/** A unit stock can be counted in besides the item's own — a SACK of 5 KG. */
export type CountingUnit = { id: string; code: string; factor: number }

/** Every unit in the UOM master built on this base unit (SACK = 5 KG for
 * KG), so a branch's stock can be counted in sacks and put on hand in KG.
 * The backend converts with the same factors; this is only for the form. */
export function useCountingUnits(baseUnitId: string | undefined): CountingUnit[] {
  const { data } = useQuery({
    queryKey: ['inventory-uoms', 'counting-units', baseUnitId],
    queryFn: () => getUoms({ limit: 500 }),
    enabled: !!baseUnitId,
    staleTime: 5 * 60_000,
  })
  const records = data?.success ? (data.data?.data ?? []) : []
  return records
    .filter((u) => u.baseUnitId === baseUnitId && Number(u.conversionFactor) > 0)
    .map((u) => ({ id: u.id, code: u.code, factor: Number(u.conversionFactor) }))
}
