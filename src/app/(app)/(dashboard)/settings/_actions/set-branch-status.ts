'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function setBranchStatus(
  branchId: string,
  action: 'deactivate' | 'reactivate'
): Promise<ApiResponse> {
  try {
    const response = await api.patch(`/branches/${branchId}/${action}`, {})

    if (!response.success) {
      return {
        success: false,
        error: response.error || `Failed to ${action} branch`,
        message: response.message,
      }
    }

    revalidatePath('/settings/branches')
    revalidatePath(`/settings/branches/${branchId}`)
    return { success: true }
  } catch (error) {
    console.error(`Error ${action}ing branch:`, error)
    return {
      success: false,
      error: `Failed to ${action} branch`,
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
