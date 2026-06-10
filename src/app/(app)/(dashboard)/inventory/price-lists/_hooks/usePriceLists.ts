'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getPriceLists } from '../_actions/get-price-lists'
import { createPriceList } from '../_actions/create-price-list'
import { getCurrencies } from '../_actions/get-currencies'
import type { PriceListFormValues } from '@/src/schema/inventory/price-lists'

export function usePriceLists() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  const listQuery = useQuery({
    queryKey: ['inventory-price-lists', { page, limit }],
    queryFn: async () => {
      const result = await getPriceLists({ page, limit })
      if (!result.success) throw new Error(result.message ?? 'Failed to load price lists')
      return result
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  const currenciesQuery = useQuery({
    queryKey: ['account-currencies'],
    queryFn: getCurrencies,
    staleTime: 10 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: PriceListFormValues) => createPriceList(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price list created', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const priceLists = listQuery.data?.data?.data ?? []
  const pagination = {
    total: listQuery.data?.data?.total ?? 0,
    page: listQuery.data?.data?.page ?? 1,
    limit: listQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((listQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    priceLists,
    pagination,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error,
    page,
    setPage,
    currencies: currenciesQuery.data ?? [],
    createPriceList: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    refetch: () => queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] }),
  }
}
