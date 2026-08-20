'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export async function getPendingInviteCount(): Promise<ApiResponse<{ count: number }>> {
  try {
    const response = await api.get<{ meta?: { total?: number }; data?: unknown[] }>(
      '/users?status=PENDING&limit=1'
    )

    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Failed to get pending invite count',
        message: response.message,
      }
    }

    return { success: true, data: { count: response.data?.meta?.total ?? 0 } }
  } catch (error) {
    console.error('Error getting pending invite count:', error)
    return {
      success: false,
      error: 'Failed to get pending invite count',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
