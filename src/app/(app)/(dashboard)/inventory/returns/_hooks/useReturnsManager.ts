'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getReturns } from '../_actions/get-returns'
import { createReturn } from '../_actions/create-return'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getSerialNumbers } from '../../serial-numbers/_actions/get-serial-numbers'
import type { CreateReturnFormValues } from '@/src/schema/inventory/returns'

export function useReturnsManager() {
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [warehouseFilter, setWarehouseFilter] = useState<string | undefined>(undefined)
  const [itemFilter, setItemFilter] = useState<string | undefined>(undefined)
  const [fromDate, setFromDate] = useState<string | undefined>(undefined)
  const [toDate, setToDate] = useState<string | undefined>(undefined)

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      warehouseId: warehouseFilter,
      itemId: itemFilter,
      startDate: fromDate,
      endDate: toDate,
    }),
    [page, limit, warehouseFilter, itemFilter, fromDate, toDate]
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

  const serialsQuery = useQuery({
    queryKey: ['inventory-serials-in-stock'],
    queryFn: () => getSerialNumbers({ status: 'in_stock', limit: 500 }),
    staleTime: 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateReturnFormValues) => createReturn(data),
    onSuccess: (result) => {
      if (result.success) {
        // The stock always moved; the accounting may not have. A note comes
        // back only when something did not happen, so it warns rather than
        // reporting a clean success the accountant would have to go and
        // disprove later.
        const note = result.data?.accountingNote
        showToast({
          title: note ? 'Return recorded — check the accounting' : 'Return processed',
          description: result.message,
          status: note ? 'warning' : 'success',
        })
        queryClient.invalidateQueries({ queryKey: ['inventory-returns'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-balances'] })
      } else {
        showToast({
          title: 'Failed to process return',
          description: result.message,
          status: 'error',
        })
      }
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
    itemFilter,
    fromDate,
    toDate,
    setWarehouseFilter: (v: string | undefined) => {
      setWarehouseFilter(v)
      setPage(1)
    },
    setItemFilter: (v: string | undefined) => {
      setItemFilter(v)
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
      setItemFilter(undefined)
      setFromDate(undefined)
      setToDate(undefined)
      setPage(1)
    },

    page,
    setPage,

    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
    serialOptions: serialsQuery.data?.data?.data ?? [],

    createReturn: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-returns'] }),
  }
}
