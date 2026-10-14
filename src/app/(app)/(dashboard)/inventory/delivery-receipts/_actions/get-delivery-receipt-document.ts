'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { PrintDocumentEnvelope } from '@/src/libs/print/printInventoryDocument'

export async function getDeliveryReceiptDocument(
  id: string
): Promise<ApiResponse<PrintDocumentEnvelope>> {
  const result = await api.get<PrintDocumentEnvelope>(`/inventory/delivery-receipts/${id}/document`)
  if (!result.success || !result.data) {
    return { success: false, error: result.error ?? 'Could not load the document', message: '' }
  }
  return { success: true, data: result.data, message: '' }
}
