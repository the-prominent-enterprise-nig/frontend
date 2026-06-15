'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export interface BranchSummary {
  employees: {
    total: number
    active: number
  }
  pos: {
    terminals: number
    activeSessions: number
    todayRevenue: number
    todayTransactions: number
    monthRevenue: number
    monthTransactions: number
  }
  hr: {
    pendingLeaveRequests: number
  }
  inventory: {
    pendingPurchaseRequests: number
    pendingPurchaseOrders: number
  }
}

export async function getBranchSummary(id: string): Promise<ApiResponse<BranchSummary>> {
  try {
    const result = await api.get<{ data: BranchSummary }>(`/branches/${id}/summary`)
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch branch summary' }
    }
    return { success: true, data: result.data.data }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to fetch branch summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
