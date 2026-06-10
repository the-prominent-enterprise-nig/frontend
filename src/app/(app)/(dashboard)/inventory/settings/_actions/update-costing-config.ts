'use server'

import { api } from '@/src/libs/api/client'
import { revalidateTag } from 'next/cache'
import type { UpsertCostingConfigFormValues } from '@/src/schema/inventory/costing'

export async function updateCostingConfig(data: UpsertCostingConfigFormValues) {
  try {
    const result = await api.post('/inventory/costing/config', {
      defaultCostingMethod: data.defaultCostingMethod,
      allowPerItemOverride: data.allowPerItemOverride,
    })

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update costing configuration',
        message: result.message,
      }
    }

    revalidateTag('inventory-costing-config', 'max')
    return { success: true, message: 'Costing configuration updated successfully' }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to update costing configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
