'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { updateBranchSchema } from '@/src/schema/settings/update-branch'
import { getSession } from '@/src/libs/auth/actions/get-session'
import { BranchFull } from './get-branch'

export async function updateBranch(id: string, input: unknown): Promise<ApiResponse<BranchFull>> {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, error: 'Unauthorized', message: 'You must be logged in' }
    }

    const result = updateBranchSchema.safeParse(input)
    if (!result.success) {
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: result.error.issues.map((i) => i.message).join(', '),
      }
    }

    const response = await api.patch<{ data: BranchFull }>(`/branches/${id}`, result.data)

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to update branch',
        message: response.message,
      }
    }

    revalidatePath(`/settings/branches/${id}`)
    revalidatePath('/settings/branches')

    return {
      success: true,
      data: response.data?.data,
      message: 'Branch updated successfully',
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to update branch',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
