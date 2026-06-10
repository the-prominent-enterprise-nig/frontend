'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { CategoryNode, CategoryNodeSchema } from '@/src/schema/inventory/categories'
import { z } from 'zod'

const TreeResponseSchema = z.object({ data: z.array(CategoryNodeSchema) })

export async function getCategoriesTree(params?: {
  status?: 'active' | 'inactive'
}): Promise<ApiResponse<{ data: CategoryNode[] }>> {
  try {
    const result = await api.get<{ data: CategoryNode[] }>('/inventory/categories/tree', {
      ...params,
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch categories',
        message: result.message,
      }
    }

    const validated = TreeResponseSchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as { data: CategoryNode[] } }
    }

    return { success: true, data: validated.data }
  } catch (error) {
    console.error('Error fetching categories tree:', error)
    return {
      success: false,
      error: 'Failed to fetch categories',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
