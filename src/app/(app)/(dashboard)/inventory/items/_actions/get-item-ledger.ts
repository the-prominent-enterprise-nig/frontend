'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { ItemLedgerResponse, ItemLedgerResponseSchema } from '@/src/schema/inventory/items/ledger'

export async function getItemLedger(
  itemId: string,
  params?: {
    warehouseId?: string
    transactionType?: string
    startDate?: string
    endDate?: string
    page?: number
    limit?: number
  }
): Promise<ApiResponse<ItemLedgerResponse>> {
  try {
    const result = await api.get<ItemLedgerResponse>(
      `/inventory/items/${itemId}/ledger`,
      { ...params },
      { tags: [`inventory-item-ledger-${itemId}`] }
    )

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch item ledger',
        message: result.message,
      }
    }

    const validated = ItemLedgerResponseSchema.safeParse(result.data)
    if (!validated.success) {
      return { success: true, data: result.data as ItemLedgerResponse }
    }

    return { success: true, data: validated.data }
  } catch (error) {
    console.error('Error fetching item ledger:', error)
    return {
      success: false,
      error: 'Failed to fetch item ledger',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
