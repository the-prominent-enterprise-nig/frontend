'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export type SenderSerial = {
  id: string
  serialNumber: string
  status: string
  item: {
    id: string
    name: string
    sku: string
    modelNumber: string | null
    brand: { name: string } | null
  } | null
  currentWarehouse: { id: string; name: string } | null
  /** Sender's in-stock unit or one of this transfer's own units — listed first. */
  fromSender: boolean
}

// Receive-time serial picker ("Wrong unit" / "Wrong serial"): the sender's
// in-stock serials (and, without itemId, this transfer's own units) first,
// then other warehouses'. Search matches serial, item, SKU, model or brand;
// itemId narrows to that item's in-stock units.
export async function getSenderSerials(
  transferId: string,
  search?: string,
  itemId?: string
): Promise<ApiResponse<SenderSerial[]>> {
  if (!transferId) {
    return { success: false, error: 'Invalid transfer ID', message: 'Transfer ID is required' }
  }

  try {
    const params = new URLSearchParams({ limit: '25' })
    if (search?.trim()) params.set('search', search.trim())
    if (itemId) params.set('itemId', itemId)
    return await api.get<SenderSerial[]>(
      `/inventory/transfers/${transferId}/sender-serials?${params.toString()}`
    )
  } catch (error) {
    return {
      success: false,
      error: 'Failed to fetch serial numbers',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
