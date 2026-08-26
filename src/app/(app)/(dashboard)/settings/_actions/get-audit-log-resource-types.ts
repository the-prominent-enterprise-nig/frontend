'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export async function getAuditLogResourceTypes(): Promise<ApiResponse<string[]>> {
  try {
    const result = await api.get<string[]>('/audit-logs/resource-types', undefined, {
      tags: ['audit-logs'],
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch resource types',
        message: result.message,
      }
    }

    return { success: true, data: result.data }
  } catch (error) {
    console.error('Error fetching audit log resource types:', error)
    return {
      success: false,
      error: 'Failed to fetch resource types',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
