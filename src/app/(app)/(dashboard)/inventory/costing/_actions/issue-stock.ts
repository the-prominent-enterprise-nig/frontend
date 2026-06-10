'use server'

import { api } from '@/src/libs/api/client'
import type { IssueStockFormValues, IssueStockResult } from '@/src/schema/inventory/costing'

export async function issueStock(data: IssueStockFormValues) {
  try {
    const result = await api.post<IssueStockResult>('/inventory/costing/issue', data)

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to issue stock',
        message: result.message,
      }
    }

    return { success: true, data: result.data, message: 'Stock issued successfully' }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to issue stock',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
