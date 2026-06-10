'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '@/src/components/ui/toast'
import { getNegativeStockPolicy } from '../_actions/get-negative-stock-policy'
import { getNegativeStockViolations } from '../_actions/get-negative-stock-violations'
import { saveNegativeStockPolicy } from '../_actions/save-negative-stock-policy'
import type { NegativeStockPolicyFormValues } from '@/src/schema/inventory/negative-stock'

export function useNegativeStock() {
  const queryClient = useQueryClient()

  const policyQuery = useQuery({
    queryKey: ['inventory-negative-stock-policy'],
    queryFn: () => getNegativeStockPolicy(),
    staleTime: 60 * 1000,
  })

  const violationsQuery = useQuery({
    queryKey: ['inventory-negative-stock-violations'],
    queryFn: async () => {
      const result = await getNegativeStockViolations({ limit: 100 })
      if (!result.success) throw new Error(result.message ?? 'Failed to load violations')
      return result
    },
    staleTime: 30 * 1000,
  })

  const saveMutation = useMutation({
    mutationFn: (data: NegativeStockPolicyFormValues) => saveNegativeStockPolicy(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Policy saved', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-negative-stock-policy'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  return {
    policy: policyQuery.data?.data ?? null,
    violations: violationsQuery.data?.data?.data ?? [],
    isLoadingPolicy: policyQuery.isLoading,
    isLoadingViolations: violationsQuery.isLoading,
    isFetching: policyQuery.isFetching || violationsQuery.isFetching,
    error: policyQuery.error || violationsQuery.error,
    savePolicy: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    refetch: () => {
      queryClient.refetchQueries({ queryKey: ['inventory-negative-stock-policy'] })
      queryClient.refetchQueries({ queryKey: ['inventory-negative-stock-violations'] })
    },
  }
}
