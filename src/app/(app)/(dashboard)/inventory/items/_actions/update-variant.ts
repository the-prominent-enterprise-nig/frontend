'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { UpdateVariantFormSchema } from '@/src/schema/inventory/variants'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function updateVariant(
  itemId: string,
  variantId: string,
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  if (!itemId || !variantId) {
    return { success: false, error: 'ID required', message: 'Item ID and variant ID are required' }
  }

  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.VARIANTS_MANAGE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to manage variants',
    }
  }

  const parsed = UpdateVariantFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const { variantSku, attributes, priceOverride } = parsed.data
  const payload: Record<string, unknown> = {}
  if (variantSku !== undefined) payload.variantSku = variantSku.toUpperCase()
  if (attributes !== undefined) {
    const attributeMap: Record<string, string> = {}
    for (const row of attributes) attributeMap[row.key] = row.value
    payload.attributes = attributeMap
  }
  if (priceOverride !== undefined) payload.priceOverride = priceOverride

  const result = await api.patch<{ id: string }>(
    `/inventory/items/${itemId}/variants/${variantId}`,
    payload
  )

  if (!result.success) {
    return {
      success: false,
      error: typeof result.error === 'string' ? result.error : 'Failed to update variant',
      message: typeof result.message === 'string' ? result.message : 'Failed to update variant',
    }
  }

  revalidatePath('/inventory/items')
  return { success: true, data: result.data, message: 'Variant updated successfully' }
}
