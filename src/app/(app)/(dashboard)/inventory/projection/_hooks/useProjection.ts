'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getProjection } from '../_actions/get-projection'
import { getStockoutAlerts } from '../_actions/get-stockout-alerts'

export const DAY_OPTIONS = [7, 14, 30, 60, 90] as const
export type DayOption = (typeof DAY_OPTIONS)[number]

export function useProjection() {
  const queryClient = useQueryClient()
  const [days, setDays] = useState<DayOption>(30)
  const [warehouseId, setWarehouseId] = useState<string | undefined>(undefined)

  const projectionQuery = useQuery({
    queryKey: ['inventory-projection', { days, warehouseId }],
    queryFn: async () => {
      const result = await getProjection({ days, warehouseId })
      if (!result.success) throw new Error(result.message ?? 'Failed to load projection')
      return result
    },
    staleTime: 60 * 1000,
  })

  const alertsQuery = useQuery({
    queryKey: ['inventory-projection-alerts', { days, warehouseId }],
    queryFn: async () => {
      const result = await getStockoutAlerts({ days, warehouseId })
      if (!result.success) throw new Error(result.message ?? 'Failed to load stockout alerts')
      return result
    },
    staleTime: 60 * 1000,
  })

  const projectionItems = projectionQuery.data?.data?.data ?? []
  const stockoutAlerts = alertsQuery.data?.data?.data ?? []

  return {
    projectionItems,
    stockoutAlerts,
    isLoading: projectionQuery.isLoading || alertsQuery.isLoading,
    isFetching: projectionQuery.isFetching || alertsQuery.isFetching,
    days,
    setDays,
    warehouseId,
    setWarehouseId,
    refetch: () => {
      queryClient.refetchQueries({ queryKey: ['inventory-projection'] })
      queryClient.refetchQueries({ queryKey: ['inventory-projection-alerts'] })
    },
  }
}
