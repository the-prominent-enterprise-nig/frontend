'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '@/src/components/ui/toast'
import { getBrands } from '../_actions/get-brands'
import { createBrand } from '../_actions/create-brand'
import { updateBrand } from '../_actions/update-brand'
import { deleteBrand } from '../_actions/delete-brand'
import type { ItemClassificationFormValues } from '@/src/schema/inventory/classification'

export function useBrands() {
  const queryClient = useQueryClient()

  const listQuery = useQuery({
    queryKey: ['inventory-item-brands'],
    queryFn: () => getBrands(),
    staleTime: 30 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: ItemClassificationFormValues) => createBrand(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Brand created', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-item-brands'] })
      } else {
        showToast({ title: 'Failed to create brand', description: result.message, status: 'error' })
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ItemClassificationFormValues }) =>
      updateBrand(id, data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Brand updated', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-item-brands'] })
      } else {
        showToast({ title: 'Failed to update brand', description: result.message, status: 'error' })
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBrand(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Brand deleted', description: result.message, status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-item-brands'] })
      } else {
        showToast({ title: 'Failed to delete brand', description: result.message, status: 'error' })
      }
    },
  })

  return {
    brands: listQuery.data?.data ?? [],
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-item-brands'] }),

    createBrand: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateBrand: (id: string, data: ItemClassificationFormValues) =>
      updateMutation.mutateAsync({ id, data }),
    isUpdating: updateMutation.isPending,
    deleteBrand: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  }
}
