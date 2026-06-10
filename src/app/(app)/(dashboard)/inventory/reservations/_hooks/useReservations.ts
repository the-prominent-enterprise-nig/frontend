'use client'

import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useState } from 'react'
import { showToast } from '@/src/components/ui/toast'
import { getReservations } from '../_actions/get-reservations'
import { createReservation } from '../_actions/create-reservation'
import { releaseReservation } from '../_actions/release-reservation'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getItems } from '../../items/_actions/get-items'
import type { ReservationFormValues } from '@/src/schema/inventory/reservations'

export function useReservations() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  const listQuery = useQuery({
    queryKey: ['inventory-reservations', { page, limit }],
    queryFn: async () => {
      const result = await getReservations({ page, limit })
      if (!result.success) throw new Error(result.message ?? 'Failed to load reservations')
      return result
    },
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  })

  const warehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active' }),
    staleTime: 5 * 60 * 1000,
  })

  const itemsQuery = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => getItems({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  })

  const createMutation = useMutation({
    mutationFn: (data: ReservationFormValues) => createReservation(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Reservation created', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-reservations'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const releaseMutation = useMutation({
    mutationFn: (id: string) => releaseReservation(id),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Reservation released', description: result.message, status: 'success' })
        queryClient.refetchQueries({ queryKey: ['inventory-reservations'] })
      } else {
        showToast({ title: 'Failed', description: result.message, status: 'error' })
      }
    },
  })

  const reservations = listQuery.data?.data?.data ?? []
  const pagination = {
    total: listQuery.data?.data?.total ?? 0,
    page: listQuery.data?.data?.page ?? 1,
    limit: listQuery.data?.data?.limit ?? limit,
    totalPages: Math.ceil((listQuery.data?.data?.total ?? 0) / limit),
  }

  return {
    reservations,
    pagination,
    isLoading: listQuery.isLoading,
    isFetching: listQuery.isFetching,
    error: listQuery.error,
    page,
    setPage,
    itemOptions: itemsQuery.data?.data?.data ?? [],
    warehouseOptions: warehousesQuery.data?.data?.data ?? [],
    createReservation: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    releaseReservation: releaseMutation.mutateAsync,
    isReleasing: releaseMutation.isPending,
    releasingId: releaseMutation.variables,
    refetch: () => queryClient.invalidateQueries({ queryKey: ['inventory-reservations'] }),
  }
}
