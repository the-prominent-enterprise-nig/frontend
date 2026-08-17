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
import { deletePriceList } from '../_actions/delete-price-list'
import { getCurrencies } from '../_actions/get-currencies'
import { getBranches } from '../_actions/get-branches'
import { getPriceUseTypes } from '../../price-use-types/_actions/get-price-use-types'
import { createPriceUseType } from '../../price-use-types/_actions/create-price-use-type'
import { humanizePriceListError } from '../_lib/humanize-error'
import type {
  ApprovePriceListFormValues,
  PriceListFormValues,
  RejectPriceListFormValues,
} from '@/src/schema/inventory/price-lists'
import type { PriceUseTypeFormValues } from '@/src/schema/inventory/price-use-types'

export function usePriceLists() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [showInactive, setShowInactive] = useState(false)

  const listQuery = useQuery({
    queryKey: ['inventory-price-lists', { page, limit, showInactive }],
    queryFn: async () => {
      const result = await getPriceLists({ page, limit, includeInactive: showInactive })
      if (!result.success) throw new Error(result.message ?? 'Failed to load price lists')
      return result
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    // Scenario 26 — same gap found live across every maker-checker list
    // this scenario touched: staleTime alone only refetches on THIS tab's
    // own refocus/remount, not when someone else's approve/reject changes
    // the record in a different browser tab/session.
    refetchInterval: 10 * 1000,
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

  const priceUseTypesQuery = useQuery({
    queryKey: ['inventory-price-use-types'],
    queryFn: getPriceUseTypes,
    staleTime: 30 * 1000,
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePriceList(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price list deleted', description: result.message, status: 'success' })
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

  const createPriceUseTypeMutation = useMutation({
    mutationFn: (data: PriceUseTypeFormValues) => createPriceUseType(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Price use type created', status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-price-use-types'] })
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
    showInactive,
    setShowInactive: (value: boolean) => {
      setShowInactive(value)
      setPage(1)
    },
    currencies: currenciesQuery.data ?? [],
    branches: branchesQuery.data ?? [],
    priceUseTypes: priceUseTypesQuery.data ?? [],
    createPriceUseType: createPriceUseTypeMutation.mutateAsync,
    isCreatingPriceUseType: createPriceUseTypeMutation.isPending,
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
    deletePriceList: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    refetch: () => queryClient.refetchQueries({ queryKey: ['inventory-price-lists'] }),
  }
}
