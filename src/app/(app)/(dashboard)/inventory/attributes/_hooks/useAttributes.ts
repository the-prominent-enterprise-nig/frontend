'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getAttributes } from '../_actions/get-attributes'
import { createAttribute } from '../_actions/create-attribute'
import { updateAttribute } from '../_actions/update-attribute'
import { getCategoriesFlat } from '../../categories/_actions/get-categories-flat'
import type { AttributeDefinitionFormValues } from '@/src/schema/inventory/attributes'

export function useAttributes() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  const listQuery = useQuery({
    queryKey: ['inventory-attributes', { page, limit }],
    queryFn: async () => {
      const result = await getAttributes({ page, limit })
      if (!result.success) throw new Error(result.message ?? 'Failed to load attributes')
      return result
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  const categoriesQuery = useQuery({
    queryKey: ['inventory-categories-lookup'],
    queryFn: () => getCategoriesFlat({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: AttributeDefinitionFormValues) => createAttribute(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Attribute created', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-attributes'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AttributeDefinitionFormValues }) =>
      updateAttribute(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Attribute updated', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-attributes'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-attribute-definitions'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const attributes = listQuery.data?.data?.data ?? []
  const pagination = {
    total: listQuery.data?.data?.total ?? 0,
    page: listQuery.data?.data?.page ?? 1,
    limit: listQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((listQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    attributes,
    pagination,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error,
    page,
    setPage,
    categoryOptions: categoriesQuery.data?.data?.data ?? [],
    createAttribute: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateAttribute: (id: string, data: AttributeDefinitionFormValues) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
    refetch: () => queryClient.refetchQueries({ queryKey: ['inventory-attributes'] }),
  }
}
