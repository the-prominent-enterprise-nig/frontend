'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getRevaluationHistory } from '../_actions/get-revaluation-history'
import { createItemRevaluation } from '../_actions/create-item-revaluation'
import { getItems } from '../../items/_actions/get-items'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import type { CreateRevaluationFormValues } from '@/src/schema/inventory/revaluation'

export function useRevaluation() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)

  const historyQuery = useQuery({
    queryKey: ['inventory-revaluation-history'],
    queryFn: async () => {
      const result = await getRevaluationHistory()
      if (!result.success) throw new Error(result.message ?? 'Failed to load revaluation history')
      return result
    },
    staleTime: 30 * 1000,
  })

  const itemsQuery = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => getItems({ limit: 200, lifecycle: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateRevaluationFormValues) => createItemRevaluation(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Revaluation created', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-revaluation-history'] })
        setIsModalOpen(false)
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const records = historyQuery.data?.data?.data ?? []

  const itemOptions = (itemsQuery.data?.data?.data ?? []).map((item) => ({
    value: item.id,
    label: `${item.name} (${item.sku})`,
  }))

  const warehouseOptions = (warehousesQuery.data?.data?.data ?? []).map((wh) => ({
    value: wh.id,
    label: `${wh.name} (${wh.code})`,
  }))

  return {
    records,
    isLoading: historyQuery.isLoading,
    isFetching: historyQuery.isFetching,
    isModalOpen,
    setIsModalOpen,
    itemOptions,
    warehouseOptions,
    createRevaluation: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    refetch: () => queryClient.refetchQueries({ queryKey: ['inventory-revaluation-history'] }),
  }
}
