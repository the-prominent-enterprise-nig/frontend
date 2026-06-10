'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getBackorders } from '../_actions/get-backorders'
import { createBackorder } from '../_actions/create-backorder'
import { updateBackorder } from '../_actions/update-backorder'
import { getItems } from '../../items/_actions/get-items'
import type {
  BackorderFormValues,
  BackorderUpdateFormValues,
} from '@/src/schema/inventory/backorders'

export function useBackorders() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  const listQuery = useQuery({
    queryKey: ['inventory-backorders', { page, limit }],
    queryFn: async () => {
      const result = await getBackorders({ page, limit })
      if (!result.success) throw new Error(result.message ?? 'Failed to load backorders')
      return result
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  const itemsQuery = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => getItems({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: BackorderFormValues) => createBackorder(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Backorder created', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-backorders'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BackorderUpdateFormValues }) =>
      updateBackorder(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Backorder updated', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-backorders'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const backorders = listQuery.data?.data?.data ?? []
  const pagination = {
    total: listQuery.data?.data?.total ?? 0,
    page: listQuery.data?.data?.page ?? 1,
    limit: listQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((listQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    backorders,
    pagination,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error,
    page,
    setPage,
    itemOptions: itemsQuery.data?.data?.data ?? [],
    createBackorder: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateBackorder: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    refetch: () => queryClient.refetchQueries({ queryKey: ['inventory-backorders'] }),
  }
}
