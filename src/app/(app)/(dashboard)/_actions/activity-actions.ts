'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export interface ActivityEntry {
  id: string
  action: string
  resourceType: string
  resourceId?: string
  resourceName?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export async function getRecentActivity(params?: {
  limit?: number
  branchId?: string
}): Promise<ApiResponse<ActivityEntry[]>> {
  try {
    const result = await api.get<ActivityEntry[]>('/audit-logs/recent', {
      limit: params?.limit,
      branchId: params?.branchId,
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch recent activity' }
    }
    return { success: true, data: result.data }
  } catch {
    return { success: false, error: 'Failed to fetch recent activity' }
  }
}
