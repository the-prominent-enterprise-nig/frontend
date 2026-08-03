'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getPriceLists } from '../_actions/get-price-lists'
import { createPriceList } from '../_actions/create-price-list'
import { updatePriceList } from '../_actions/update-price-list'
import { approvePriceList } from '../_actions/approve-price-list'
import { rejectPriceList } from '../_actions/reject-price-list'
import { resubmitPriceList } from '../_actions/resubmit-price-list'
import { getCurrencies } from '../_actions/get-currencies'
import { getBranches } from '../_actions/get-branches'
import { humanizePriceListError } from '../_lib/humanize-error'
import type {
  ApprovePriceListFormValues,
  PriceListFormValues,
  RejectPriceListFormValues,
} from '@/src/schema/inventory/price-lists'

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

  const branchesQuery = useQuery({
    queryKey: ['branches'],
    queryFn: getBranches,
    staleTime: 10 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: PriceListFormValues) => createPriceList(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price list created', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] })
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
    mutationFn: ({ id, data }: { id: string; data: PriceListFormValues }) =>
      updatePriceList(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price list updated', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] })
      } else {
        showToast({
          title: 'Failed',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApprovePriceListFormValues }) =>
      approvePriceList(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price list approved', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] })
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
    mutationFn: ({ id, data }: { id: string; data: RejectPriceListFormValues }) =>
      rejectPriceList(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price list rejected', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] })
      } else {
        showToast({
          title: 'Failed',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
      }
    },
  })

  const resubmitMutation = useMutation({
    mutationFn: (id: string) => resubmitPriceList(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({
          title: 'Resubmitted for approval',
          description: result.message,
          status: 'success',
        })
        queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] })
      } else {
        showToast({
          title: 'Failed',
          description: humanizePriceListError(result.message),
          status: 'error',
        })
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
    branches: branchesQuery.data ?? [],
    createPriceList: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updatePriceList: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    approvePriceList: approveMutation.mutateAsync,
    isApproving: approveMutation.isPending,
    rejectPriceList: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,
    resubmitPriceList: resubmitMutation.mutateAsync,
    isResubmitting: resubmitMutation.isPending,
    refetch: () => queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] }),
  }
}
