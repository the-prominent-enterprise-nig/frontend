'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '@/src/components/ui/toast'
import { getPriceUseTypes } from '../_actions/get-price-use-types'
import { createPriceUseType } from '../_actions/create-price-use-type'
import { updatePriceUseType } from '../_actions/update-price-use-type'
import { deletePriceUseType } from '../_actions/delete-price-use-type'
import { humanizePriceListError } from '../../price-lists/_lib/humanize-error'
import type { PriceUseTypeFormValues } from '@/src/schema/inventory/price-use-types'

export function usePriceUseTypes() {
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: ['inventory-price-use-types'],
    queryFn: getPriceUseTypes,
    staleTime: 30 * 1000,
  })

  function refetch() {
    return queryClient.refetchQueries({ queryKey: ['inventory-price-use-types'] })
  }

  const createMutation = useMutation({
    mutationFn: (data: PriceUseTypeFormValues) => createPriceUseType(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price use type created', status: 'success' })
        refetch()
      } else {
        showToast({
          title: 'Failed',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PriceUseTypeFormValues }) =>
      updatePriceUseType(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price use type updated', status: 'success' })
        refetch()
      } else {
        showToast({
          title: 'Failed',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePriceUseType(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price use type deleted', status: 'success' })
        refetch()
      } else {
        showToast({
          title: 'Failed',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  return {
    priceUseTypes: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error,
    createPriceUseType: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updatePriceUseType: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deletePriceUseType: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    refetch,
  }
}
