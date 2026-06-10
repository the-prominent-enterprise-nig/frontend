'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  PermissionListResponse,
  PermissionListResponseSchema,
  QueryParams,
} from '@/src/schema/settings/list'
import { cookies } from 'next/headers'

/**
 * Get permissions list with pagination, search, and filters
 */
export async function getPermissions(
  params?: QueryParams
): Promise<ApiResponse<PermissionListResponse>> {
  try {
    // Verify auth token exists
    const cookieStore = await cookies()
    const authToken = cookieStore.get('authToken')?.value

    if (!authToken) {
      console.error('No auth token found in cookies')
      return {
        success: false,
        error: 'Authentication required',
        message: 'No authentication token found',
      }
    }

    const tags = [
      'permissions',
      params?.search ? `permissions-search-${params.search}` : 'permissions-search',
      params?.status ? `permissions-status-${params.status}` : 'permissions-status',
    ]

    const result = await api.get<PermissionListResponse>('/permissions', params, { tags })

    if (!result.success || !result.data) {
      console.error('API Error:', result.error, result.message)
      return {
        success: false,
        error: result.error || 'Failed to fetch permissions',
        message: result.message,
      }
    }

    // Validate response structure
    const validated = PermissionListResponseSchema.parse(result.data)

    return {
      success: true,
      data: validated,
    }
  } catch (error) {
    console.error('Error fetching permissions:', error)
    return {
      success: false,
      error: 'Failed to fetch permissions',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
