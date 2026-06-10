'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getReorderRules } from '../../reorder/_actions/get-reorder-rules'
import { upsertStockLevel } from '../_actions/upsert-stock-level'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getItems } from '../../items/_actions/get-items'
import type { ReorderRule, StockLevelFormValues } from '@/src/schema/inventory/reorder'

export function useStockLevels() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [selectedRule, setSelectedRule] = useState<ReorderRule | null>(null)

  const queryParams = useMemo(() => ({ page, limit }), [page, limit])

  const rulesQuery = useQuery({
    queryKey: ['inventory-stock-levels', queryParams],
    queryFn: () => getReorderRules(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const itemsQuery = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => getItems({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  })

  const upsertMutation = useMutation({
    mutationFn: (data: StockLevelFormValues) => upsertStockLevel(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Stock level boundaries saved',
          description: result.message,
          status: 'success',
        })
        setSelectedRule(null)
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-levels'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const rules = rulesQuery.data?.data?.data ?? []

  const pagination = {
    total: rulesQuery.data?.data?.total ?? 0,
    page: rulesQuery.data?.data?.page ?? 1,
    limit: rulesQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((rulesQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    rules,
    pagination,
    isLoading: rulesQuery.isLoading,
    isFetching: rulesQuery.isFetching,
    selectedRule,
    setSelectedRule,
    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
    itemOptions: itemsQuery.data?.data?.data ?? [],
    upsertStockLevel: upsertMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,
    page,
    setPage,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-stock-levels'] }),
  }
}
