'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export interface BranchDetail {
  id: string
  name: string
  code: string | null
  type: string
  addressLine1: string | null
  city: string | null
  status: string
  isActive: boolean
  createdAt: string
  employeeCount: number
  manager: {
    id: string
    name: string | null
    firstName: string | null
    lastName: string | null
  } | null
}

export async function getBranches(): Promise<ApiResponse<BranchDetail[]>> {
  try {
    const result = await api.get<BranchDetail[]>('/enterprise/branches', undefined, {
      tags: ['branches'],
    })
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to fetch branches' }
    }
    return { success: true, data: result.data }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to fetch branches',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
