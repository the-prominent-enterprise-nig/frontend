'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { assignRoleSchema } from '@/src/schema/settings/assign-role'
import { getSession } from '@/src/libs/auth/actions/get-session'
import { can } from '@/src/libs/guards/permission'

interface AssignRoleResponse {
  userId: string
  roleId: string
  assignedAt: string
}

/**
 * Assign a role to a user
 */
export async function assignRole(input: unknown): Promise<ApiResponse<AssignRoleResponse>> {
  try {
    // Verify user is authenticated
    const session = await getSession()
    if (!session) {
      return {
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in to assign roles',
      }
    }

    // Check if user has permission to manage users or roles
    if (!can(session, 'admin:users:update') && !can(session, 'admin:users:manage')) {
      return {
        success: false,
        error: 'Forbidden',
        message:
          'You do not have permission to assign roles. Required: admin:users:update or admin:users:manage',
      }
    }

    // Validate input data
    const result = assignRoleSchema.safeParse(input)
    if (!result.success) {
      return {
        success: false,
        error: 'Validation failed',
        message: result.error.issues.map((issue) => issue.message).join(', '),
      }
    }

    const { userId, roleId } = result.data

    // Call API to assign role to user
    const response = await api.post<AssignRoleResponse>(`/users/${userId}/roles`, { roleId })

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to assign role',
        message: response.message,
      }
    }

    // Revalidate the settings page to show updated data
    revalidatePath('/settings')
    revalidatePath('/settings/users')

    return {
      success: true,
      data: response.data,
      message: 'Successfully assigned role to the user',
    }
  } catch (error) {
    console.error('Error assigning role:', error)
    return {
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
    }
  }
}
