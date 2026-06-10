'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  Payslip,
  CreatePayslipInput,
  UpdatePayslipInput,
} from '@/src/schema/human-resource/payslips'
import { revalidateTag } from 'next/cache'

const TAGS = { all: 'payslips' }

export async function getPayslips(): Promise<ApiResponse<Payslip[]>> {
  try {
    const result = await api.get<Payslip[]>('/payslips', undefined, {
      tags: [TAGS.all],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch payslips' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch payslips' }
  }
}

export async function getMyPayslips(): Promise<ApiResponse<Payslip[]>> {
  try {
    const result = await api.get<Payslip[]>('/payslips/me', undefined, {
      tags: ['my-payslips'],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch payslips' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch payslips' }
  }
}

export async function getPayslipsByEmployee(employeeId: string): Promise<ApiResponse<Payslip[]>> {
  try {
    const result = await api.get<Payslip[]>(`/payslips/employee/${employeeId}`, undefined, {
      tags: [TAGS.all, `payslips-employee-${employeeId}`],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch payslips' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch payslips for employee' }
  }
}

export async function getPayslip(id: string): Promise<ApiResponse<Payslip>> {
  try {
    const result = await api.get<Payslip>(`/payslips/${id}`, undefined, {
      tags: [`payslip-${id}`],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Payslip not found' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch payslip' }
  }
}

export async function createPayslip(input: CreatePayslipInput): Promise<ApiResponse<Payslip>> {
  try {
    const result = await api.post<Payslip>('/payslips', input)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to create payslip' }
    }
    revalidateTag(TAGS.all, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to create payslip' }
  }
}

export async function updatePayslip(
  id: string,
  data: UpdatePayslipInput
): Promise<ApiResponse<Payslip>> {
  try {
    const result = await api.patch<Payslip>(`/payslips/${id}`, data)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to update payslip' }
    }
    revalidateTag(TAGS.all, 'max')
    revalidateTag(`payslip-${id}`, 'max')
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to update payslip' }
  }
}

export async function deletePayslip(id: string): Promise<ApiResponse<void>> {
  try {
    const result = await api.delete(`/payslips/${id}`)
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to delete payslip' }
    }
    revalidateTag(TAGS.all, 'max')
    revalidateTag(`payslip-${id}`, 'max')
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to delete payslip' }
  }
}
