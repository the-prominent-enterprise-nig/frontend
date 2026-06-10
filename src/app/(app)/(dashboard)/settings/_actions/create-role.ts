'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { createRoleSchema } from '@/src/schema/settings/create-role'
import { getSession } from '@/src/libs/auth/actions/get-session'
import { can } from '@/src/libs/guards/permission'

interface CreateRoleResponse {
  id: string
  name: string
  description?: string
}

/**
 * Create a new role
 */
export async function createRole(input: unknown): Promise<ApiResponse<CreateRoleResponse>> {
  try {
    // Verify user is authenticated
    const session = await getSession()
    if (!session) {
      return {
        success: false,
        error: 'Unauthorized',
        message: 'You must be logged in to create roles',
      }
    }

    // Check if user has permission to create roles
    if (!can(session, 'admin:roles:create') && !can(session, 'admin:roles:manage')) {
      return {
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to create roles. Required: create:roles',
      }
    }

    // Validate input data
    const result = createRoleSchema.safeParse(input)
    if (!result.success) {
      return {
        success: false,
        error: 'Validation failed',
        message: result.error.issues.map((issue) => issue.message).join(', '),
      }
    }

    // Call API to create role
    const response = await api.post<CreateRoleResponse>('/roles', result.data)

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to create role',
        message: response.message,
      }
    }

    // Revalidate roles cache
    revalidatePath('/settings/roles')

    return {
      success: true,
      data: response.data,
      message: 'Role created successfully',
    }
  } catch (error) {
    console.error('Error creating role:', error)
    return {
      success: false,
      error: 'Failed to create role',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
