'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { assignBranchSchema } from '@/src/schema/settings/assign-branch'
import { getSession } from '@/src/libs/auth/actions/get-session'
import { can } from '@/src/libs/guards/permission'

interface AssignBranchResponse {
  userId: string
  branchId: string
  assignedAt: string
}

/**
 * Assign a branch to a user
 */
export async function assignBranch(input: unknown): Promise<ApiResponse<AssignBranchResponse>> {
  try {
    // Verify user is authenticated
    const session = await getSession()
    if (!session) {
      return {
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in to assign branches',
      }
    }

    // Check if user has permission to manage users or branches
    if (!can(session, 'admin:users:update') && !can(session, 'admin:users:manage')) {
      return {
        success: false,
        error: 'Forbidden',
        message:
          'You do not have permission to assign branches. Required: admin:users:update or admin:users:manage',
      }
    }

    // Validate input data
    const result = assignBranchSchema.safeParse(input)
    if (!result.success) {
      return {
        success: false,
        error: 'Validation failed',
        message: result.error.issues.map((issue) => issue.message).join(', '),
      }
    }

    const { userId, branchId } = result.data

    // Call API to assign branch to user
    const response = await api.post<AssignBranchResponse>(`/users/${userId}/branches`, { branchId })

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to assign branch',
        message: response.message,
      }
    }

    // Revalidate the settings page to show updated data
    revalidatePath('/settings')
    revalidatePath('/settings/users')

    return {
      success: true,
      data: response.data,
      message: 'Successfully assigned branch to the user',
    }
  } catch (error) {
    console.error('Error assigning branch:', error)
    return {
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
    }
  }
}
