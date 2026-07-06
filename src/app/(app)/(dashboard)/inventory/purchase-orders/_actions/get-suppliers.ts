'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export interface SupplierOption {
  id: string
  code: string
  name: string
  taxId?: string | null
}

interface SupplierListResponse {
  data: SupplierOption[]
  total: number
}

export async function getSuppliers(params?: {
  search?: string
  limit?: number
}): Promise<ApiResponse<SupplierListResponse>> {
  try {
    const result = await api.get<SupplierListResponse>(
      '/suppliers',
      { ...params },
      { tags: ['suppliers'] }
    )

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch suppliers',
        message: result.message,
      }
    }

    return { success: true, data: result.data }
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return {
      success: false,
      error: 'Failed to fetch suppliers',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
