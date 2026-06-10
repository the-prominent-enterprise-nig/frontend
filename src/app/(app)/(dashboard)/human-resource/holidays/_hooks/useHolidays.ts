'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  applyPhilippineTemplate,
} from '../_actions/holiday-actions'
import { CreateHolidayInput, UpdateHolidayInput } from '@/src/schema/human-resource/holidays'
import { toast } from 'sonner'

export function useHolidays(year?: number) {
  return useQuery({
    queryKey: ['holidays', year ?? 'all'],
    queryFn: () => getHolidays(year ? { year } : undefined),
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateHolidayInput) => createHoliday(input),
    onSuccess: (result) => {
      if (result.success) {
        qc.invalidateQueries({ queryKey: ['holidays'] })
        toast.success('Holiday created')
      } else {
        toast.error(result.error ?? 'Failed to create holiday')
      }
    },
    onError: () => toast.error('Failed to create holiday'),
  })
}

export function useUpdateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateHolidayInput }) =>
      updateHoliday(id, input),
    onSuccess: (result) => {
      if (result.success) {
        qc.invalidateQueries({ queryKey: ['holidays'] })
        toast.success('Holiday updated')
      } else {
        toast.error(result.error ?? 'Failed to update holiday')
      }
    },
    onError: () => toast.error('Failed to update holiday'),
  })
}

export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteHoliday(id),
    onSuccess: (result) => {
      if (result.success) {
        qc.invalidateQueries({ queryKey: ['holidays'] })
        toast.success('Holiday deleted')
      } else {
        toast.error(result.error ?? 'Failed to delete holiday')
      }
    },
    onError: () => toast.error('Failed to delete holiday'),
  })
}

export function useApplyPhilippineTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (year: number) => applyPhilippineTemplate(year),
    onSuccess: (result) => {
      if (result.success && result.data) {
        qc.invalidateQueries({ queryKey: ['holidays'] })
        const { created, skipped } = result.data
        toast.success(
          `Template applied: ${created} holidays created, ${skipped} skipped (already existed)`
        )
      } else {
        toast.error(result.error ?? 'Failed to apply template')
      }
    },
    onError: () => toast.error('Failed to apply Philippine template'),
  })
}
