'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWarehouses } from '@/src/app/(app)/(dashboard)/inventory/warehouses/_actions/get-warehouses'
import { getBranches } from '@/src/app/(app)/(dashboard)/inventory/price-lists/_actions/get-branches'
import {
  branchToken,
  splitLocationTokens,
  warehouseToken,
  type LocationToken,
} from '@/src/libs/inventory/location-tokens'

export type Region = 'panay' | 'negros'

export type LocationFilter = {
  locations: LocationToken[]
  setLocations: (v: LocationToken[]) => void
  region: Region | undefined
  setRegion: (v: Region | undefined) => void
  /** The picker's choices — narrowed to the selected operation. */
  locationOptions: { value: string; label: string }[]
  locationsLoading: boolean
  branchIds: string[]
  warehouseIds: string[]
  reset: () => void
}

/**
 * Scenario 56 — the Operations + multi-select Branches pair, shared by every
 * inventory list (Stock Balance, Ledger, Serial Numbers, Transfers) so they
 * offer the same locations and narrow them the same way. Lifted out of
 * useStockBalance unchanged.
 *
 * The picker lists real branches plus the 2 standalone warehouses (not all
 * warehouse rows, which put a branch's shadow warehouse under the same
 * label). Picking an operation narrows the branch list, and drops any picked
 * branch outside it, so the two filters can never disagree.
 *
 * @param onChange runs after any selection change (lists reset to page 1).
 */
export function useLocationFilter(
  opts: { initialLocations?: LocationToken[]; onChange?: () => void } = {}
): LocationFilter {
  const [locations, setLocationsState] = useState<LocationToken[]>(opts.initialLocations ?? [])
  const [region, setRegionState] = useState<Region | undefined>(undefined)

  // Key kept distinct from the Serial Numbers tab's ['branches-lookup'] — a
  // differently-shaped getBranches response sharing one key crashed whichever
  // screen loaded second.
  const branchesQuery = useQuery({
    queryKey: ['inventory-stock-balance-branches'],
    queryFn: () => getBranches(),
    staleTime: 5 * 60 * 1000,
  })
  const standaloneWarehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-standalone'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active', standaloneOnly: true }),
    staleTime: 5 * 60 * 1000,
  })

  const allLocationOptions = useMemo(() => {
    // `type: 'warehouse'` branches are bookkeeping rows for the standalone
    // warehouses listed below in their own right.
    const branches = (branchesQuery.data ?? [])
      .filter((b) => b.type !== 'warehouse')
      .map((b) => ({ value: branchToken(b.id), label: b.name, region: b.region ?? null }))
    const warehouses = (standaloneWarehousesQuery.data?.data?.data ?? []).map((wh) => ({
      value: warehouseToken(wh.id),
      label: wh.name,
      region: wh.region ?? null,
    }))
    return [...warehouses, ...branches].sort((a, b) => a.label.localeCompare(b.label))
  }, [branchesQuery.data, standaloneWarehousesQuery.data])

  const locationOptions = useMemo(
    () =>
      (region ? allLocationOptions.filter((o) => o.region === region) : allLocationOptions).map(
        ({ value, label }) => ({ value, label })
      ),
    [allLocationOptions, region]
  )

  const { branchIds, warehouseIds } = useMemo(() => splitLocationTokens(locations), [locations])

  return {
    locations,
    setLocations: (v) => {
      setLocationsState(v)
      opts.onChange?.()
    },
    region,
    setRegion: (v) => {
      setRegionState(v)
      if (v) {
        const allowed = new Set(
          allLocationOptions.filter((o) => o.region === v).map((o) => o.value)
        )
        setLocationsState((prev) => prev.filter((token) => allowed.has(token)))
      }
      opts.onChange?.()
    },
    locationOptions,
    locationsLoading: branchesQuery.isLoading || standaloneWarehousesQuery.isLoading,
    branchIds,
    warehouseIds,
    reset: () => {
      setLocationsState([])
      setRegionState(undefined)
    },
  }
}
