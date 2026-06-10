'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getLandedCosts } from '../_actions/get-landed-costs'
import { createLandedCost } from '../_actions/create-landed-cost'
import { getGoodsReceipts } from '../_actions/get-goods-receipts'
import type { LandedCostFormValues } from '@/src/schema/inventory/landed-cost'

export function useLandedCosts() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  const listQuery = useQuery({
    queryKey: ['inventory-landed-costs', { page, limit }],
    queryFn: async () => {
      const result = await getLandedCosts({ page, limit })
      if (!result.success) throw new Error(result.message ?? 'Failed to load landed costs')
      return result
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  const goodsReceiptsQuery = useQuery({
    queryKey: ['inventory-goods-receipts-lookup'],
    queryFn: () => getGoodsReceipts({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: LandedCostFormValues) => createLandedCost(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Landed cost created', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-landed-costs'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const landedCosts = listQuery.data?.data?.data ?? []
  const pagination = {
    total: listQuery.data?.data?.total ?? 0,
    page: listQuery.data?.data?.page ?? 1,
    limit: listQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((listQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    landedCosts,
    pagination,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error,
    page,
    setPage,
    goodsReceiptOptions: goodsReceiptsQuery.data?.data?.data ?? [],
    createLandedCost: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    refetch: () => queryClient.refetchQueries({ queryKey: ['inventory-landed-costs'] }),
  }
}
