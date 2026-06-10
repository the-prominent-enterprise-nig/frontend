'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { AttributeDefinitionListResponse } from '@/src/schema/inventory/attributes'

type Params = {
  page?: number
  limit?: number
  categoryId?: string
}

export async function getAttributes(
  params: Params = {}
): Promise<ApiResponse<AttributeDefinitionListResponse>> {
  try {
    const result = await api.get('/inventory/attributes/definitions', {
      categoryId: params.categoryId,
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to fetch attributes',
        message: result.message,
      }
    }

    const raw = result.data
    const page = params.page ?? 1
    const limit = params.limit ?? 20

    if (Array.isArray(raw)) {
      const start = (page - 1) * limit
      return {
        success: true,
        data: { data: raw.slice(start, start + limit), total: raw.length, page, limit },
      }
    }

    if (raw && Array.isArray((raw as AttributeDefinitionListResponse).data)) {
      return { success: true, data: raw as AttributeDefinitionListResponse }
    }

    return {
      success: false,
      error: 'Unexpected response shape',
      message: 'Failed to parse attributes response',
    }
  } catch (error) {
    console.error('Error fetching attributes:', error)
    return {
      success: false,
      error: 'Failed to fetch attributes',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
