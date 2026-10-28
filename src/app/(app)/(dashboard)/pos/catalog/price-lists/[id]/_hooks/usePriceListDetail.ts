'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { showToast } from '@/src/components/ui/toast'
import { getPriceList } from '../../_actions/get-price-list'
import { approvePriceList } from '../../_actions/approve-price-list'
import { rejectPriceList } from '../../_actions/reject-price-list'
import { getBranches } from '../../_actions/get-branches'
import { humanizePriceListError } from '../../_lib/humanize-error'
import type {
  ApprovePriceListFormValues,
  RejectPriceListFormValues,
} from '@/src/schema/inventory/price-lists'

export function usePriceListDetail(priceListId: string) {
  const queryClient = useQueryClient()

  const detailQuery = useQuery({
    queryKey: ['inventory-price-list-detail', priceListId],
    queryFn: async () => {
      const res = await getPriceList(priceListId)
      if (!res.success) throw new Error(res.error ?? 'Failed to load price list')
      return res.data
    },
    staleTime: 10 * 1000,
  })

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: getBranches,
    staleTime: 10 * 60 * 1000,
  })

  function refetch() {
    return queryClient.refetchQueries({ queryKey: ['inventory-price-list-detail', priceListId] })
  }

  function refetchListTable() {
    return queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] })
  }

  const approveMutation = useMutation({
    mutationFn: (data: ApprovePriceListFormValues) => approvePriceList(priceListId, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price list approved', status: 'success' })
        refetch()
        refetchListTable()
      } else {
        showToast({
          title: 'Failed',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (data: RejectPriceListFormValues) => rejectPriceList(priceListId, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price list rejected', status: 'success' })
        refetch()
        refetchListTable()
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
    priceList: detailQuery.data,
    isLoading: detailQuery.isLoading,
    error: detailQuery.error,
    branches: branchesQuery.data ?? [],
    refetch,
    approvePriceList: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    rejectPriceList: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,
  }
}
