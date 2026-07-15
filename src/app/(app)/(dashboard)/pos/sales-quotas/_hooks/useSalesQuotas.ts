'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '@/src/components/ui/toast'
import { STALE } from '@/src/libs/query/stale-times'
import { getSalesQuotas } from '../_actions/get-sales-quotas'
import { getSalesQuotaUsage } from '../_actions/get-quota-usage'
import { createSalesQuota } from '../_actions/create-sales-quota'
import { updateSalesQuota } from '../_actions/update-sales-quota'
import type { CreateSalesQuotaValues, UpdateSalesQuotaValues } from '@/src/schema/pos/sales-quotas'

export function useSalesQuotas() {
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: ['sales-quotas'],
    queryFn: () => getSalesQuotas(),
    staleTime: STALE.OPERATIONAL,
  })

  const usageQuery = useQuery({
    queryKey: ['sales-quota-usage'],
    queryFn: () => getSalesQuotaUsage(),
    staleTime: STALE.OPERATIONAL,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateSalesQuotaValues) => createSalesQuota(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Target created', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['sales-quotas'] })
        queryClient.invalidateQueries({ queryKey: ['sales-quota-usage'] })
      } else {
        showToast({
          title: 'Failed to create target',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSalesQuotaValues }) =>
      updateSalesQuota(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Target updated', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['sales-quotas'] })
        queryClient.invalidateQueries({ queryKey: ['sales-quota-usage'] })
      } else {
        showToast({
          title: 'Failed to update target',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const quotas = listQuery.data?.data ?? []
  const usage = usageQuery.data?.data ?? null

  return {
    quotas,
    usage,
    isLoading: listQuery.isLoading,
    isUsageLoading: usageQuery.isLoading,

    createQuota: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateQuota: (id: string, data: UpdateSalesQuotaValues) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
  }
}
