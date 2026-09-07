'use server'

import { api } from '@/src/libs/api/client'
import type { ReceivingReport } from '@/src/schema/inventory/goods-receiving'

export interface UpdateReceivingReportBody {
  supplierInvoiceNumber?: string
  deliveryReceiptNumber?: string
  notes?: string
  vatAmount?: number
  withheldAmount?: number
  lines?: {
    id: string
    batchNumber?: string
    notes?: string
    srp?: number
    discounts?: unknown[]
    taxCode?: string
    taxAmount?: number
  }[]
}

/** Scenario 46 — correct a receiving report after the fact, chiefly to add the
 * supplier invoice number once it arrives. Quantity and unit cost are absent by
 * design: those moved stock and wrote cost layers when the receipt posted. */
export async function updateReceivingReport(id: string, body: UpdateReceivingReportBody) {
  return api.patch<ReceivingReport>(`/inventory/stock/receiving-reports/${id}`, body)
}
