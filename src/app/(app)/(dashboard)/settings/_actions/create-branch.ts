'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { createBranchSchema } from '@/src/schema/settings/create-branch'
import { getSession } from '@/src/libs/auth/actions/get-session'

export async function createBranch(input: unknown): Promise<ApiResponse> {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, error: 'Unauthorized', message: 'You must be logged in' }
    }

    const result = createBranchSchema.safeParse(input)
    if (!result.success) {
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: result.error.issues.map((i) => i.message).join(', '),
      }
    }

    const response = await api.post('/branches', result.data)

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to create branch',
        message: response.message,
      }
    }

    revalidatePath('/settings/branches')

    return { success: true, message: 'Branch created successfully' }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to create branch',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
