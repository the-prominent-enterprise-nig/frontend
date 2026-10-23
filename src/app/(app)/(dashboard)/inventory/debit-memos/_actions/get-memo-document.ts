'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { PrintDocumentEnvelope } from '@/src/libs/print/printInventoryDocument'

/** Print envelope for either kind of debit memo (Scenario 72). */
export async function getMemoDocument(
  kind: 'supplier' | 'internal',
  id: string
): Promise<ApiResponse<PrintDocumentEnvelope>> {
  const endpoint =
    kind === 'supplier'
      ? `/debit-memo-documents/supplier/${id}`
      : `/inventory-debit-memos/${id}/document`
  const result = await api.get<PrintDocumentEnvelope>(endpoint)
  if (!result.success || !result.data) {
    return { success: false, error: result.error ?? 'Could not load the debit memo', message: '' }
  }
  return { success: true, data: result.data, message: '' }
}
