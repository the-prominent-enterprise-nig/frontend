'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import type { BranchPaymentMethodsResponse, PosPaymentMethod } from '@/src/schema/pos'

export async function getBranchPaymentMethods(
  branchId: string
): Promise<{ success: boolean; data?: BranchPaymentMethodsResponse; error?: string }> {
  try {
    const response = await api.get<BranchPaymentMethodsResponse>(
      `/pos/branches/${branchId}/payment-methods`
    )
    if (!response.success || !response.data) {
      return { success: false, error: response.error || 'Failed to load payment methods' }
    }
    return { success: true, data: response.data }
  } catch {
    return { success: false, error: 'Failed to load payment methods' }
  }
}

export async function saveBranchPaymentMethods(
  branchId: string,
  changes: { method: PosPaymentMethod; isEnabled: boolean }[]
): Promise<ApiResponse> {
  try {
    const response = await api.patch(`/pos/branches/${branchId}/payment-methods`, { changes })
    if (!response.success) {
      return { success: false, error: response.error || 'Failed to save payment methods' }
    }
    revalidatePath(`/settings/branches/${branchId}`)
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to save payment methods' }
  }
}

export async function resetBranchPaymentMethods(branchId: string): Promise<ApiResponse> {
  try {
    const response = await api.delete(`/pos/branches/${branchId}/payment-methods/overrides`)
    if (!response.success) {
      return { success: false, error: response.error || 'Failed to reset payment methods' }
    }
    revalidatePath(`/settings/branches/${branchId}`)
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to reset payment methods' }
  }
}
