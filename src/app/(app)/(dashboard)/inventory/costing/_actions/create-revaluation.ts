'use server'

import { api } from '@/src/libs/api/client'
import type { CreateRevaluationFormValues } from '@/src/schema/inventory/costing'

export async function createRevaluation(data: CreateRevaluationFormValues) {
  try {
    const result = await api.post('/inventory/costing/revaluation', data)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create revaluation',
        message: result.message,
      }
    }

    return { success: true, data: result.data, message: 'Revaluation recorded successfully' }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to create revaluation',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
