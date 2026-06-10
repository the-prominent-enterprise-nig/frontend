'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateVariantFormSchema } from '@/src/schema/inventory/variants'

export async function createVariant(
  itemId: string,
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  if (!itemId) return { success: false, error: 'ID required', message: 'Item ID is required' }

  const parsed = CreateVariantFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const { variantSku, attributes, priceOverride } = parsed.data

  // Convert attribute rows array → Record<string, string>
  const attributeMap: Record<string, string> = {}
  for (const row of attributes) {
    attributeMap[row.key] = row.value
  }

  const payload: Record<string, unknown> = {
    variantSku: variantSku.toUpperCase(),
    attributes: attributeMap,
  }
  if (priceOverride !== undefined) payload.priceOverride = priceOverride

  const result = await api.post<{ id: string }>(`/inventory/items/${itemId}/variants`, payload)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create variant',
      message: msg || errStr || 'Failed to create variant',
    }
  }

  return {
    success: true,
    data: result.data,
    message: `Variant ${variantSku.toUpperCase()} created`,
  }
}
