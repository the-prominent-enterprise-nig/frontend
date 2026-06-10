'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  SupplierListResponse,
  SupplierListResponseSchema,
} from '@/src/schema/procurement/suppliers/types'

export async function getSuppliers(params?: {
  page?: number
  limit?: number
  search?: string
  status?: string
  onboardingStatus?: string
}): Promise<ApiResponse<SupplierListResponse>> {
  try {
    const tags = [
      'suppliers',
      params?.search ? `suppliers-search-${params.search}` : 'suppliers-search',
      params?.status ? `suppliers-status-${params.status}` : 'suppliers-status',
      params?.onboardingStatus
        ? `suppliers-onboarding-${params.onboardingStatus}`
        : 'suppliers-onboarding',
    ]

    const result = await api.get<SupplierListResponse>('/suppliers', params, {
      tags,
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch suppliers',
        message: result.message,
      }
    }

    const validated = SupplierListResponseSchema.parse(result.data)

    return { success: true, data: validated }
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return {
      success: false,
      error: 'Failed to fetch suppliers',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
