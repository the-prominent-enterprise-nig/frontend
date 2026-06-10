'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCostingConfig } from '../_actions/get-costing-config'
import { updateCostingConfig } from '../_actions/update-costing-config'
import { showToast } from '@/src/components/ui/toast'
import type { UpsertCostingConfigFormValues } from '@/src/schema/inventory/costing'

export function useCostingConfig() {
  const queryClient = useQueryClient()

  const configQuery = useQuery({
    queryKey: ['inventory-costing-config'],
    queryFn: () => getCostingConfig(),
    staleTime: 5 * 60 * 1000,
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpsertCostingConfigFormValues) => updateCostingConfig(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Costing method updated',
          description: result.message,
          status: 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['inventory-costing-config'] })
      } else {
        showToast({ title: 'Update failed', description: result.message, status: 'error' })
      }
    },
    onError: () => {
      showToast({
        title: 'Update failed',
        description: 'An unexpected error occurred.',
        status: 'error',
      })
    },
  })

  return {
    config: configQuery.data?.data ?? null,
    isLoading: configQuery.isLoading,
    error: configQuery.error,
    updateConfig: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  }
}
