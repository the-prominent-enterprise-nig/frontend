'use server'

import { api } from '@/src/libs/api/client'
import type { ReceivingReport } from '@/src/schema/inventory/goods-receiving'

export interface UpdateReceivingReportBody {
  supplierInvoiceNumber?: string
  deliveryReceiptNumber?: string
  notes?: string
  vatAmount?: number
  withheldAmount?: number
  /** Scenario 51 — required whenever a line's unitCost changes, and rejected
   * when none does, so a reason always describes a real ledger event. */
  costCorrectionReason?: string
  lines?: {
    id: string
    batchNumber?: string
    notes?: string
    srp?: number
    discounts?: unknown[]
    taxCode?: string
    taxAmount?: number
    /** Scenario 51 — the corrected unit cost. Unlike every other field here,
     * this one revalues cost layers and posts an adjusting journal entry. */
    unitCost?: number
  }[]
}

/** Scenario 46 — correct a receiving report after the fact, chiefly to add the
 * supplier invoice number once it arrives. Quantity is absent by design: it
 * moved physical stock when the receipt posted. Unit cost was absent for the
 * same reason until Scenario 51 made it correctable, with a reason and an
 * adjusting entry. */
export async function updateReceivingReport(id: string, body: UpdateReceivingReportBody) {
  return api.patch<ReceivingReport>(`/inventory/stock/receiving-reports/${id}`, body)
}
