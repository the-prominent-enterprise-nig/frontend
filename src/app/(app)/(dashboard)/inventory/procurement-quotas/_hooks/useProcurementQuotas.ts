'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '@/src/components/ui/toast'
import { STALE } from '@/src/libs/query/stale-times'
import { getProcurementQuotas } from '../_actions/get-procurement-quotas'
import { getQuotaUsage } from '../_actions/get-quota-usage'
import { createProcurementQuota } from '../_actions/create-procurement-quota'
import { updateProcurementQuota } from '../_actions/update-procurement-quota'
import type {
  CreateProcurementQuotaValues,
  UpdateProcurementQuotaValues,
} from '@/src/schema/inventory/procurement-quotas'

export function useProcurementQuotas() {
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: ['procurement-quotas'],
    queryFn: () => getProcurementQuotas(),
    staleTime: STALE.OPERATIONAL,
  })

  const usageQuery = useQuery({
    queryKey: ['procurement-quota-usage'],
    queryFn: () => getQuotaUsage(),
    staleTime: STALE.OPERATIONAL,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateProcurementQuotaValues) => createProcurementQuota(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Quota created', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['procurement-quotas'] })
        queryClient.invalidateQueries({ queryKey: ['procurement-quota-usage'] })
      } else {
        showToast({ title: 'Failed to create quota', description: result.message, status: 'error' })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProcurementQuotaValues }) =>
      updateProcurementQuota(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Quota updated', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['procurement-quotas'] })
        queryClient.invalidateQueries({ queryKey: ['procurement-quota-usage'] })
      } else {
        showToast({ title: 'Failed to update quota', description: result.message, status: 'error' })
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

    updateQuota: (id: string, data: UpdateProcurementQuotaValues) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
  }
}
