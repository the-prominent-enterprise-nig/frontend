'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getReorderRules } from '../_actions/get-reorder-rules'
import { upsertReorderRule } from '../_actions/upsert-reorder-rule'
import { getReorderAlerts } from '../_actions/get-reorder-alerts'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getItems } from '../../items/_actions/get-items'
import type { ReorderRuleFormValues } from '@/src/schema/inventory/reorder'

export function useReorder() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<'rules' | 'alerts'>('alerts')

  const queryParams = useMemo(
    () => ({ page, limit, warehouseId: warehouseFilter }),
    [page, limit, warehouseFilter]
  )

  const rulesQuery = useQuery({
    queryKey: ['inventory-reorder-rules', queryParams],
    queryFn: () => getReorderRules(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    enabled: activeTab === 'rules',
  })

  const alertsQuery = useQuery({
    queryKey: ['inventory-reorder-alerts'],
    queryFn: () => getReorderAlerts({ limit: 100 }),
    staleTime: 30 * 1000,
    enabled: activeTab === 'alerts',
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
    mutationFn: (data: ReorderRuleFormValues) => upsertReorderRule(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Reorder rule saved', description: result.message, status: 'success' })
        setActiveTab('rules')
        queryClient.invalidateQueries({ queryKey: ['inventory-reorder-rules'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const rules = rulesQuery.data?.data?.data ?? []
  const alerts = alertsQuery.data?.data?.data ?? []

  const rulesPagination = {
    total: rulesQuery.data?.data?.total ?? 0,
    page: rulesQuery.data?.data?.page ?? 1,
    limit: rulesQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((rulesQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    rules,
    alerts,
    rulesPagination,
    isLoadingRules: rulesQuery.isLoading,
    isLoadingAlerts: alertsQuery.isLoading,
    isFetching: rulesQuery.isFetching || alertsQuery.isFetching,
    error: rulesQuery.error || alertsQuery.error,

    activeTab,
    setActiveTab,

    warehouseFilter,
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },

    page,
    setPage,

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
    itemOptions: itemsQuery.data?.data?.data ?? [],

    upsertRule: upsertMutation.mutateAsync,
    isUpserting: upsertMutation.isPending,

    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-reorder-rules'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-reorder-alerts'] })
    },
  }
}
