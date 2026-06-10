'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { VariantListResponse, VariantSummarySchema } from '@/src/schema/inventory/variants'

export async function getVariants(itemId: string): Promise<ApiResponse<VariantListResponse>> {
  if (!itemId) return { success: false, error: 'ID required', message: 'Item ID is required' }

  const result = await api.get(`/inventory/items/${itemId}/variants`)

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to load variants',
      message: typeof result.message === 'string' ? result.message : 'Failed to load variants',
    }
  }

  const raw = result.data

  // API may return a plain array or a { data: [...] } envelope
  let items: unknown[]
  if (Array.isArray(raw)) {
    items = raw
  } else if (
    raw &&
    typeof raw === 'object' &&
    Array.isArray((raw as Record<string, unknown>).data)
  ) {
    items = (raw as Record<string, unknown>).data as unknown[]
  } else {
    items = []
  }

  const data = items.map((v) => {
    const p = VariantSummarySchema.safeParse(v)
    return p.success ? p.data : (v as any)
  })

  return { success: true, data: { data, total: data.length } }
}
