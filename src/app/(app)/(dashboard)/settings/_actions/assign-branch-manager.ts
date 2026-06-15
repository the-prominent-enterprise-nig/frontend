'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { BranchFull } from './get-branch'

export async function assignBranchManager(
  branchId: string,
  userId: string
): Promise<ApiResponse<BranchFull>> {
  try {
    const response = await api.post<{ data: BranchFull }>(`/branches/${branchId}/managers`, {
      userId,
    })

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to assign manager',
        message: response.message,
      }
    }

    revalidatePath(`/settings/branches/${branchId}`)
    revalidatePath('/settings/branches')

    return { success: true, data: response.data?.data }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to assign manager',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
