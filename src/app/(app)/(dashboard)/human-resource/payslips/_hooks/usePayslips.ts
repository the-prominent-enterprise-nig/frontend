'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPayslips,
  getPayslipsByEmployee,
  getPayslip,
  createPayslip,
  updatePayslip,
  deletePayslip,
} from '../_actions/payslip-actions'
import type { CreatePayslipInput, UpdatePayslipInput } from '@/src/schema/human-resource/payslips'

export function usePayslips() {
  return useQuery({
    queryKey: ['payslips'],
    queryFn: () => getPayslips(),
    staleTime: 2 * 60 * 1000,
  })
}

export function usePayslipsByEmployee(employeeId: string) {
  return useQuery({
    queryKey: ['payslips', 'employee', employeeId],
    queryFn: () => getPayslipsByEmployee(employeeId),
    enabled: !!employeeId,
    staleTime: 2 * 60 * 1000,
  })
}

export function usePayslip(id: string) {
  return useQuery({
    queryKey: ['payslip', id],
    queryFn: () => getPayslip(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreatePayslip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePayslipInput) => createPayslip(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payslips'] })
    },
  })
}

export function useUpdatePayslip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePayslipInput }) => updatePayslip(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['payslips'] })
      queryClient.invalidateQueries({ queryKey: ['payslip', id] })
    },
  })
}

export function useDeletePayslip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePayslip(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payslips'] })
    },
  })
}
