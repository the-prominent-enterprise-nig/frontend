'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { UpdateItemFormSchema } from '@/src/schema/inventory/items'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function updateItem(id: string, input: unknown): Promise<ApiResponse<void>> {
  if (!id) {
    return { success: false, error: 'Invalid item ID', message: 'Item ID is required' }
  }

  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to update items',
    }
  }

  const parsed = UpdateItemFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch(`/inventory/items/${id}`, parsed.data)

  if (!result.success) {
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const isDuplicateSku =
      errStr.includes('409') ||
      msg.toLowerCase().includes('sku') ||
      msg.toLowerCase().includes('already exists')

    if (isDuplicateSku) {
      return {
        success: false,
        error: 'duplicate_sku',
        message: `SKU "${parsed.data.sku}" already exists. Please use a unique SKU.`,
      }
    }

    return {
      success: false,
      error: result.error || 'Failed to update item',
      message: result.message,
    }
  }

  revalidatePath('/inventory/items')

  return { success: true, message: 'Item updated successfully' }
}

export async function updateItemLifecycle(
  id: string,
  lifecycle: 'active' | 'discontinued' | 'archived'
): Promise<ApiResponse<void>> {
  if (!id) {
    return { success: false, error: 'Invalid item ID', message: 'Item ID is required' }
  }

  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_MANAGE_LIFECYCLE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to change item lifecycle',
    }
  }

  const result = await api.patch(`/inventory/items/${id}/lifecycle`, { lifecycle })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update lifecycle',
      message: msg || errStr || 'Failed to update lifecycle',
    }
  }

  revalidatePath('/inventory/items')

  return { success: true, message: `Item status set to ${lifecycle}` }
}
