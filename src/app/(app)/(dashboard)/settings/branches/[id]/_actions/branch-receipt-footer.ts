'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import type { BranchReceiptFooterResponse } from '@/src/schema/pos'

export async function getBranchReceiptFooter(branchId: string): Promise<{
  success: boolean
  data?: BranchReceiptFooterResponse
  error?: string
  errorCode?: string
}> {
  try {
    const response = await api.get<BranchReceiptFooterResponse>(
      `/pos/branches/${branchId}/receipt-footer`
    )
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to load receipt footer',
        errorCode: response.errorCode,
      }
    }
    return { success: true, data: response.data }
  } catch {
    return { success: false, error: 'Failed to load receipt footer' }
  }
}

export async function updateBranchReceiptFooter(
  branchId: string,
  footerText: string | null
): Promise<ApiResponse<BranchReceiptFooterResponse>> {
  try {
    const response = await api.patch<BranchReceiptFooterResponse>(
      `/pos/branches/${branchId}/receipt-footer`,
      { footerText }
    )
    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to save receipt footer',
        errorCode: response.errorCode,
      }
    }
    revalidatePath(`/settings/branches/${branchId}`)
    return response
  } catch {
    return { success: false, error: 'Failed to save receipt footer' }
  }
}
