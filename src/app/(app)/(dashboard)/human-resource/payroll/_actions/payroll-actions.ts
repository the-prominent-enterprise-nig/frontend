'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  PayrollPeriod,
  CreatePayrollPeriodInput,
  GeneratePayslipsInput,
} from '@/src/schema/human-resource/payroll'
import { revalidateTag } from 'next/cache'

const TAGS = { all: 'payroll-periods' }

export async function getPayrollPeriods(): Promise<ApiResponse<PayrollPeriod[]>> {
  try {
    const result = await api.get<PayrollPeriod[]>('/payroll/periods', undefined, {
      tags: [TAGS.all],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch payroll periods' }
    }
    return { success: true, data: result.data }
  } catch (error) {
    return { success: false, error: 'Failed to fetch payroll periods' }
  }
}

export async function getPayrollPeriod(id: string): Promise<ApiResponse<PayrollPeriod>> {
  try {
    const result = await api.get<PayrollPeriod>(`/payroll/periods/${id}`, undefined, {
      tags: [`payroll-period-${id}`],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Period not found' }
    }
    return { success: true, data: result.data }
  } catch (error) {
    console.error('getPayrollPeriod error:', error)
    return { success: false, error: 'Failed to fetch payroll period' }
  }
}

export async function createPayrollPeriod(
  input: CreatePayrollPeriodInput
): Promise<ApiResponse<PayrollPeriod>> {
  try {
    const result = await api.post<PayrollPeriod>('/payroll/periods', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create payroll period' }
    }
    revalidateTag(TAGS.all, 'max')
    return { success: true, data: result.data }
  } catch (error) {
    return { success: false, error: 'Failed to create payroll period' }
  }
}

export async function generatePayslips(input: GeneratePayslipsInput): Promise<ApiResponse<void>> {
  try {
    const result = await api.post('/payroll/payslips', input)
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to generate payslips' }
    }
    revalidateTag(TAGS.all, 'max')
    revalidateTag(`payroll-period-${input.payrollPeriodId}`, 'max')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to generate payslips' }
  }
}

export async function deletePayslipsByPeriodId(periodId: string): Promise<ApiResponse<void>> {
  try {
    const result = await api.delete(`/payroll/periods/${periodId}/payslips`)
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete payslips' }
    }
    revalidateTag(`payroll-period-${periodId}`, 'max')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to delete payslips' }
  }
}

export async function updatePayrollPeriod(
  id: string,
  data: Partial<{
    note: string
    totalActualDays: number
    totalDailyRate: number
    totalAmount: number
    totalDeductions: number
    totalNetPay: number
    status: string
    approvalDate: string | null
    approvalNote: string | null
  }>
): Promise<ApiResponse<PayrollPeriod>> {
  try {
    const result = await api.patch<PayrollPeriod>(`/payroll/periods/${id}`, data)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to update period' }
    }
    revalidateTag(TAGS.all, 'max')
    revalidateTag(`payroll-period-${id}`, 'max')
    return { success: true, data: result.data }
  } catch (error) {
    return { success: false, error: 'Failed to update period' }
  }
}

export async function resetPayrollApproval(periodId: string): Promise<ApiResponse<void>> {
  try {
    const result = await api.patch(`/payroll/periods/${periodId}/reset-approval`, {})
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to reset approval' }
    }
    revalidateTag(`payroll-period-${periodId}`, 'max')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to reset approval' }
  }
}
