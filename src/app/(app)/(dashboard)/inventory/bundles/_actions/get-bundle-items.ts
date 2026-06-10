'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { ItemListResponse, ItemListResponseSchema } from '@/src/schema/inventory/items'

export async function getBundleItems(params?: {
  page?: number
  limit?: number
  search?: string
}): Promise<ApiResponse<ItemListResponse>> {
  const result = await api.get<ItemListResponse>('/inventory/items', {
    page: params?.page ?? 1,
    limit: params?.limit ?? 50,
    search: params?.search,
  })

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to load items',
      message: typeof result.message === 'string' ? result.message : 'Failed to load items',
    }
  }

  // Filter on the raw response BEFORE Zod parsing so the filter always runs even
  // if the schema parse fails. isBundle is stored on every item by the backend.
  const rawItems: any[] = Array.isArray(result.data?.data) ? result.data.data : []
  const hasBundleFlag = rawItems.some((item) => typeof item.isBundle === 'boolean')
  const filteredRaw = hasBundleFlag ? rawItems.filter((item) => item.isBundle === true) : rawItems

  const rawFiltered = {
    ...result.data,
    data: filteredRaw,
    total: hasBundleFlag ? filteredRaw.length : (result.data?.total ?? filteredRaw.length),
  }

  const parsed = ItemListResponseSchema.safeParse(rawFiltered)
  return { success: true, data: parsed.success ? parsed.data : (rawFiltered as any) }
}
