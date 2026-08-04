'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { ItemClassificationFormSchema } from '@/src/schema/inventory/classification'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function createBrand(input: unknown): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_MANAGE_CLASSIFICATION)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to manage item classification',
    }
  }

  const parsed = ItemClassificationFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post('/inventory/classification/brands', parsed.data)

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to create brand',
      message: result.message || 'Failed to create brand',
    }
  }

  revalidatePath('/inventory/catalog')

  return { success: true, data: result.data, message: 'Brand created successfully' }
}
