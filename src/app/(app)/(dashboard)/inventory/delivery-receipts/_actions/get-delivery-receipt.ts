'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { DrDetailSchema, type DrDetail } from '@/src/schema/inventory/delivery-receipts'

export async function getDeliveryReceipt(id: string): Promise<ApiResponse<DrDetail>> {
  const result = await api.get<DrDetail>(`/inventory/delivery-receipts/${id}`)
  if (!result.success || !result.data) {
    return { success: false, error: result.error ?? 'Delivery receipt not found', message: '' }
  }
  const parsed = DrDetailSchema.safeParse(result.data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid response from server', message: '' }
  }
  return { success: true, data: parsed.data, message: '' }
}
