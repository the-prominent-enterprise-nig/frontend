'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export interface ActivityEntry {
  id: string
  action: string
  resourceType: string
  resourceId?: string
  resourceName?: string
  metadata?: Record<string, unknown>
  // Only ever populated for the AccountingAuditLog-backed types added in
  // Scenario 29 Gap 9 (inventory:stock-adjustment, inventory:transfer,
  // pos:gift-card) — the original 3 UserAuditLog-backed types have no
  // before/after columns and always send these as null/absent.
  newValues?: Record<string, unknown> | null
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
