'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getReturns } from '../_actions/get-returns'
import { createCustomerReturn } from '../_actions/create-customer-return'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import type { CustomerReturnFormValues } from '@/src/schema/inventory/returns'

export function useReturnsManager() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [fromDate, setFromDate] = useState<string | undefined>(undefined)
  const [toDate, setToDate] = useState<string | undefined>(undefined)

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      warehouseId: warehouseFilter,
      startDate: fromDate,
      endDate: toDate,
    }),
    [page, limit, warehouseFilter, fromDate, toDate]
  )

  const returnsQuery = useQuery({
    queryKey: ['inventory-returns', queryParams],
    queryFn: () => getReturns(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: CustomerReturnFormValues) => createCustomerReturn(data),
    onSuccess: (result) => {
      if (!result.success) {
        showToast({
          title: 'Could not record the return',
          description: result.message,
          status: 'error',
        })
        return
      }

      // No success toast. The screen now holds the result open in a dialog
      // until the clerk dismisses it, because the RR number on it is what they
      // write on the customer's copy — and a message that fades after four
      // seconds is a number they have to go and look up again. The same dialog
      // carries the credit-memo outcome, including the case where one was
      // expected and did not happen.
      queryClient.invalidateQueries({ queryKey: ['inventory-returns'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-stock-balances'] })
    },
  })

  const returns = returnsQuery.data?.data?.data ?? []
  const pagination = {
    total: returnsQuery.data?.data?.total ?? 0,
    page: returnsQuery.data?.data?.page ?? 1,
    limit: returnsQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((returnsQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    returns,
    pagination,
    isLoading: returnsQuery.isLoading,
    isFetching: returnsQuery.isFetching,
    error: returnsQuery.error,

    warehouseFilter,
    fromDate,
    toDate,
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },
    setFromDate: (v: string | undefined) => {
      setFromDate(v)
      setPage(1)
    },
    setToDate: (v: string | undefined) => {
      setToDate(v)
      setPage(1)
    },
    resetFilters: () => {
      setWarehouseFilter(undefined)
      setFromDate(undefined)
      setToDate(undefined)
      setPage(1)
    },

    page,
    setPage,

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],

    createReturn: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-returns'] }),
  }
}
