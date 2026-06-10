'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { RoleListResponse, RoleListResponseSchema, QueryParams } from '@/src/schema/settings/list'
import { cookies } from 'next/headers'

/**
 * Get roles list with pagination, search, and filters
 */
export async function getRoles(params?: QueryParams): Promise<ApiResponse<RoleListResponse>> {
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
      'roles',
      params?.search ? `roles-search-${params.search}` : 'roles-search',
      params?.status ? `roles-status-${params.status}` : 'roles-status',
    ]

    const result = await api.get<RoleListResponse>('/roles', params, { tags })

    if (!result.success || !result.data) {
      console.error('API Error:', result.error, result.message)
      return {
        success: false,
        error: result.error || 'Failed to fetch roles',
        message: result.message,
      }
    }

    // Validate response structure
    const validated = RoleListResponseSchema.parse(result.data)

    return {
      success: true,
      data: validated,
    }
  } catch (error) {
    console.error('Error fetching roles:', error)
    return {
      success: false,
      error: 'Failed to fetch roles',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
