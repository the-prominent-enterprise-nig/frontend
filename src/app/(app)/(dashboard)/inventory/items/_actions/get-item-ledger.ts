'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { ItemLedgerResponse, ItemLedgerResponseSchema } from '@/src/schema/inventory/items/ledger'

export async function getItemLedger(
  itemId: string,
  params?: {
    warehouseId?: string
    // Scenario 50 — scopes Movements to the locations the Item 360 drawer was
    // opened with, same as the Stock tab's getItemStockSummary.
    branchIds?: string[]
    warehouseIds?: string[]
    transactionType?: string
    // Scenario 56 — the list's Operations filter, carried into Item 360.
    region?: 'panay' | 'negros'
    startDate?: string
    endDate?: string
    page?: number
    limit?: number
  }
): Promise<ApiResponse<ItemLedgerResponse>> {
  try {
    const result = await api.get<ItemLedgerResponse>(
      `/inventory/items/${itemId}/ledger`,
      {
        ...params,
        branchIds: params?.branchIds?.length ? params.branchIds.join(',') : undefined,
        warehouseIds: params?.warehouseIds?.length ? params.warehouseIds.join(',') : undefined,
      },
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
