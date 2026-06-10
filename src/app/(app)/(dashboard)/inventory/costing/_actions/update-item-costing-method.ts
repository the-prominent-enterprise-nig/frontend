'use server'

import { api } from '@/src/libs/api/client'
import type { UpdateItemCostingMethodFormValues } from '@/src/schema/inventory/costing'

export async function updateItemCostingMethod(
  itemId: string,
  data: UpdateItemCostingMethodFormValues
) {
  try {
    const result = await api.patch(`/inventory/costing/items/${itemId}`, data)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update item costing method',
        message: result.message,
      }
    }

    return { success: true, data: result.data, message: 'Item costing method updated' }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to update item costing method',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
