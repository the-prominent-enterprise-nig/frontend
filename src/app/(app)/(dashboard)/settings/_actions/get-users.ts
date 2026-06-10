'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  UserListResponse,
  UserListResponseSchema,
  UserQueryParams,
} from '@/src/schema/settings/list'

/**
 * Get users list with pagination, search, and filters
 */
export async function getUsers(params?: UserQueryParams): Promise<ApiResponse<UserListResponse>> {
  try {
    const tags = [
      'users',
      params?.search ? `users-search-${params.search}` : 'users-search',
      params?.status ? `users-status-${params.status}` : 'users-status',
    ]

    const result = await api.get<UserListResponse>('/users', params, { tags })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch users',
        message: result.message,
      }
    }

    // Validate response structure
    const validated = UserListResponseSchema.parse(result.data)

    return {
      success: true,
      data: validated,
    }
  } catch (error) {
    console.error('Error fetching users:', error)
    return {
      success: false,
      error: 'Failed to fetch users',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
