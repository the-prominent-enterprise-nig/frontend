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

/** The DR's debit memo, internal (DMINV) or supplier, ready to print. */
export async function getDeliveryReceiptDebitMemoDocument(
  id: string
): Promise<ApiResponse<PrintDocumentEnvelope>> {
  const result = await api.get<PrintDocumentEnvelope>(
    `/inventory/delivery-receipts/${id}/debit-memo-document`
  )
  if (!result.success || !result.data) {
    return { success: false, error: result.error ?? 'Could not load the debit memo', message: '' }
  }
  return { success: true, data: result.data, message: '' }
}

/** Everything the DR's one Print needs: the DR, and its debit memo (either
 * kind) when it has one, printed together. */
export async function getDeliveryReceiptPrint(
  id: string,
  hasMemo: boolean
): Promise<ApiResponse<{ dr: PrintDocumentEnvelope; memo: PrintDocumentEnvelope | null }>> {
  const [dr, memo] = await Promise.all([
    getDeliveryReceiptDocument(id),
    hasMemo ? getDeliveryReceiptDebitMemoDocument(id) : null,
  ])
  if (!dr.success || !dr.data) return { success: false, error: dr.error, message: '' }
  return { success: true, data: { dr: dr.data, memo: memo?.data ?? null }, message: '' }
}
