'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getPayrollPeriods,
  getPayrollPeriod,
  createPayrollPeriod,
  generatePayslips,
  deletePayslipsByPeriodId,
  updatePayrollPeriod,
  resetPayrollApproval,
} from '../_actions/payroll-actions'
import type {
  CreatePayrollPeriodInput,
  GeneratePayslipsInput,
} from '@/src/schema/human-resource/payroll'

export function usePayrollPeriods() {
  return useQuery({
    queryKey: ['payroll-periods'],
    queryFn: () => getPayrollPeriods(),
    staleTime: 2 * 60 * 1000,
  })
}

export function usePayrollPeriod(id: string) {
  return useQuery({
    queryKey: ['payroll-period', id],
    queryFn: () => getPayrollPeriod(id),
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreatePayrollPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePayrollPeriodInput) => createPayrollPeriod(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
    },
  })
}

export function useGeneratePayslips() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GeneratePayslipsInput) => generatePayslips(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-period', variables.payrollPeriodId] })
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
    },
  })
}

export function useDeletePayslips() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (periodId: string) => deletePayslipsByPeriodId(periodId),
    onSuccess: (_, periodId) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-period', periodId] })
    },
  })
}

export function useUpdatePayrollPeriod() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updatePayrollPeriod>[1] }) =>
      updatePayrollPeriod(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-period', id] })
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
    },
  })
}

export function useResetPayrollApproval() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (periodId: string) => resetPayrollApproval(periodId),
    onSuccess: (_, periodId) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-period', periodId] })
    },
  })
}
