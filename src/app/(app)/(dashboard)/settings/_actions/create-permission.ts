'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { createPermissionSchema } from '@/src/schema/settings/create-permission'

interface CreatePermissionResponse {
  id: string
  module: string
  resource: string
  action: string
  description?: string
}

/**
 * Create a new permission
 */
export async function createPermission(
  input: unknown
): Promise<ApiResponse<CreatePermissionResponse>> {
  try {
    // Validate input data
    const result = createPermissionSchema.safeParse(input)
    if (!result.success) {
      return {
        success: false,
        error: 'Validation failed',
        message: result.error.issues.map((issue) => issue.message).join(', '),
      }
    }

    // Call API to create permission
    const response = await api.post<CreatePermissionResponse>('/permissions', result.data)

    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to create permission',
        message: response.message,
      }
    }

    // Revalidate permissions cache
    revalidatePath('/settings/permissions')

    return {
      success: true,
      data: response.data,
      message: 'Permission created successfully',
    }
  } catch (error) {
    console.error('Error creating permission:', error)
    return {
      success: false,
      error: 'Failed to create permission',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
