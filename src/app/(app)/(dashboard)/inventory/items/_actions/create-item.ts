'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import {
  CreateItemFormSchema,
  CreateItemFormSchemaNoCost,
  CreateItemFormValues,
} from '@/src/schema/inventory/items'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function createItem(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to create items',
    }
  }

  // Scenario 05 followup — a caller without cost-view submits no costPrice
  // at all (the field is hidden client-side); validate against the schema
  // variant that matches, rather than the always-required one rejecting a
  // legitimate no-cost submission.
  const canViewCost = can(session, INVENTORY_PERMISSIONS.COST_VIEW)
  const schema = canViewCost ? CreateItemFormSchema : CreateItemFormSchemaNoCost
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const data: CreateItemFormValues = {
    ...parsed.data,
  }

  const result = await api.post<{ id: string }>('/inventory/items', data)

  if (!result.success) {
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    // 409 = duplicate SKU
    const isDuplicateSku =
      errStr.includes('409') ||
      msg.toLowerCase().includes('sku') ||
      msg.toLowerCase().includes('already exists') ||
      msg.toLowerCase().includes('duplicate')

    if (isDuplicateSku) {
      return {
        success: false,
        error: 'duplicate_sku',
        message: `SKU "${parsed.data.sku}" already exists. Please use a unique SKU.`,
      }
    }

    return {
      success: false,
      error: result.error || 'Failed to create item',
      message: result.message,
    }
  }

  revalidatePath('/inventory/items')

  return {
    success: true,
    data: result.data,
    message: 'Item created as draft. Submit it for review when ready.',
  }
}
