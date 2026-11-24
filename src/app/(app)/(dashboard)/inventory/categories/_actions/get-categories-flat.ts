'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  FlatCategoryListResponse,
  FlatCategoryListResponseSchema,
} from '@/src/schema/inventory/categories'

export async function getCategoriesFlat(params?: {
  page?: number
  limit?: number
  search?: string
  status?: 'active' | 'inactive'
}): Promise<ApiResponse<FlatCategoryListResponse>> {
  try {
    const result = await api.get<FlatCategoryListResponse>('/inventory/categories', {
      ...params,
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch categories',
        message: result.message,
      }
    }

    const validated = FlatCategoryListResponseSchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as FlatCategoryListResponse }
    }

    return { success: true, data: validated.data }
  } catch (error) {
    console.error('Error fetching categories:', error)
    return {
      success: false,
      error: 'Failed to fetch categories',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * EVERY category matching the filters — pages through the list until the
 * server's total is reached. A category dropdown has to offer all of them: it
 * used to ask for one page (200, then 500) and so stopped listing categories
 * once the tree outgrew it (386 today). Categories are a bounded, slowly
 * growing reference list, so loading them whole is right here — unlike items
 * or customers, which are searched on the server instead.
 */
export async function getAllCategoriesFlat(params?: {
  search?: string
  status?: 'active' | 'inactive'
}): Promise<ApiResponse<FlatCategoryListResponse>> {
  const PAGE_SIZE = 500
  const MAX_PAGES = 20
  const first = await getCategoriesFlat({ ...params, page: 1, limit: PAGE_SIZE })
  if (!first.success || !first.data) return first

  const rows = [...first.data.data]
  const total = first.data.total ?? rows.length
  for (let page = 2; rows.length < total && page <= MAX_PAGES; page++) {
    const next = await getCategoriesFlat({ ...params, page, limit: PAGE_SIZE })
    if (!next.success || !next.data || next.data.data.length === 0) break
    rows.push(...next.data.data)
  }
  return { ...first, data: { ...first.data, data: rows, limit: rows.length } }
}
