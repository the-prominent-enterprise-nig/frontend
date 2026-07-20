'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import type { BranchReceiptConfigResponse } from '@/src/schema/pos'

export async function getBranchReceiptConfig(branchId: string): Promise<{
  success: boolean
  data?: BranchReceiptConfigResponse
  error?: string
  errorCode?: string
}> {
  try {
    const response = await api.get<BranchReceiptConfigResponse>(
      `/pos/branches/${branchId}/receipt-config`
    )
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to load receipt config',
        errorCode: response.errorCode,
      }
    }
    return { success: true, data: response.data }
  } catch {
    return { success: false, error: 'Failed to load receipt config' }
  }
}

export async function updateBranchReceiptConfig(
  branchId: string,
  patch: { logoUrl?: string | null; headerText?: string | null; footerText?: string | null }
): Promise<ApiResponse<BranchReceiptConfigResponse>> {
  try {
    const response = await api.patch<BranchReceiptConfigResponse>(
      `/pos/branches/${branchId}/receipt-config`,
      patch
    )
    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to save receipt config',
        errorCode: response.errorCode,
      }
    }
    revalidatePath('/pos/settings/receipt-branding')
    return response
  } catch {
    return { success: false, error: 'Failed to save receipt config' }
  }
}

export async function uploadBranchReceiptLogo(
  branchId: string,
  formData: FormData
): Promise<ApiResponse<{ logoUrl: string }>> {
  try {
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const authToken = cookieStore.get('authToken')?.value
    const apiBase = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '')

    const response = await fetch(`${apiBase}/pos/branches/${branchId}/receipt-config/logo`, {
      method: 'POST',
      headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
      body: formData,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return {
        success: false,
        error: err.message ?? err.errorCode ?? `Upload failed (${response.status})`,
        errorCode: err.errorCode,
      }
    }

    const json = await response.json()
    revalidatePath('/pos/settings/receipt-branding')
    return { success: true, data: json.data }
  } catch {
    return { success: false, error: 'Upload failed' }
  }
}
