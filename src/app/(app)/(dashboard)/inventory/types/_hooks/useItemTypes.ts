'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '@/src/components/ui/toast'
import { getTypes } from '../_actions/get-types'
import { createType } from '../_actions/create-type'
import { updateType } from '../_actions/update-type'
import { deleteType } from '../_actions/delete-type'
import type { ItemClassificationFormValues } from '@/src/schema/inventory/classification'

export function useItemTypes() {
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: ['inventory-item-types'],
    queryFn: () => getTypes(),
    staleTime: 30 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: ItemClassificationFormValues) => createType(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Type created', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-item-types'] })
      } else {
        showToast({ title: 'Failed to create type', description: result.message, status: 'error' })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ItemClassificationFormValues }) =>
      updateType(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Type updated', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-item-types'] })
      } else {
        showToast({ title: 'Failed to update type', description: result.message, status: 'error' })
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteType(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Type deleted', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-item-types'] })
      } else {
        showToast({ title: 'Failed to delete type', description: result.message, status: 'error' })
      }
    },
  })

  return {
    types: listQuery.data?.data ?? [],
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-item-types'] }),

    createType: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateType: (id: string, data: ItemClassificationFormValues) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
    deleteType: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  }
}
