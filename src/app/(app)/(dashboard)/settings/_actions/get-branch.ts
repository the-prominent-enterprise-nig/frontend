'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export interface BranchManager {
  id: string
  name: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
}

export interface BranchFull {
  id: string
  name: string
  code: string | null
  type: string
  addressLine1: string | null
  city: string | null
  status: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  employeeCount: number
  manager: BranchManager | null
  managers: BranchManager[]
}

export async function getBranch(id: string): Promise<ApiResponse<BranchFull>> {
  try {
    const result = await api.get<{ data: BranchFull }>(`/branches/${id}`, undefined, {
      tags: ['branch', `branch-${id}`],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch branch' }
    }
    return { success: true, data: result.data.data }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to fetch branch',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
