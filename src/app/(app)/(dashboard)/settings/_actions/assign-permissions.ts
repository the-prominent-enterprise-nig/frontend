'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { assignPermissionsSchema } from '@/src/schema/settings/assign-permissions'
import { getSession } from '@/src/libs/auth/actions/get-session'
import { can } from '@/src/libs/guards/permission'

interface AssignPermissionsResponse {
  roleId: string
  permissionIds: string[]
  assignedCount: number
}

/**
 * Assign permissions to a role
 */
export async function assignPermissions(
  input: unknown
): Promise<ApiResponse<AssignPermissionsResponse>> {
  try {
    // Verify user is authenticated
    const session = await getSession()
    if (!session) {
      return {
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in to assign permissions',
      }
    }

    // Check if user has permission to manage roles
    if (!can(session, 'admin:roles:update') && !can(session, 'admin:roles:manage')) {
      return {
        success: false,
        error: 'Forbidden',
        message:
          'You do not have permission to assign permissions. Required: admin:roles:update or admin:roles:manage',
      }
    }

    // Validate input data
    const result = assignPermissionsSchema.safeParse(input)
    if (!result.success) {
      return {
        success: false,
        error: 'Validation failed',
        message: result.error.issues.map((issue) => issue.message).join(', '),
      }
    }

    const { roleId, permissionIds } = result.data

    // Call API to assign permissions to role
    const response = await api.post<AssignPermissionsResponse>(`/roles/${roleId}/permissions`, {
      permissionIds,
    })

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to assign permissions',
        message: response.message,
      }
    }

    // Revalidate the settings page to show updated data
    revalidatePath('/settings')
    revalidatePath('/settings/roles')

    return {
      success: true,
      data: response.data,
      message: `Successfully assigned permissions to the role`,
    }
  } catch (error) {
    console.error('Error assigning permissions:', error)
    return {
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
    }
  }
}
