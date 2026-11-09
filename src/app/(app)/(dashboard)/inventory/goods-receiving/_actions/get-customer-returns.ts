'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

/** What was done with a returned unit at the POS return. */
export type ReturnDisposition = 'restock' | 'quarantine' | 'scrap' | 'repair' | 'exchange'

/** A customer return already processed at the POS — it moved the stock and
 * credited the customer, and carries its own receiving report # (RRC-…). */
export interface CustomerReturnRecord {
  id: string
  returnNumber: string
  receivingReportNumber: string
  /** The Sales Invoice No. the unit was sold on (else the POS number). */
  siNumber: string | null
  returnedAt: string
  returnedAtBranch: { id: string; name: string }
  soldAtBranch: { id: string; name: string } | null
  customer: { id: string; name: string; customerCode: string } | null
  units: {
    id: string
    itemName: string
    modelNumber: string | null
    brand: string | null
    serialNumber: string | null
    quantity: number
    disposition: ReturnDisposition
  }[]
}

/** Ticket #27 — the Return reason on Create RR looks these up; it never
 * receives a returned unit a second time. `search` matches the RRC #, the
 * return #, the Sales Invoice No., the customer, an item, or a serial. */
export async function getCustomerReturns(params: {
  search?: string
}): Promise<ApiResponse<CustomerReturnRecord[]>> {
  try {
    const result = await api.get<CustomerReturnRecord[]>('/inventory/stock/customer-returns', {
      ...params,
    })
    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to search customer returns',
        message: result.message,
      }
    }
    return { success: true, data: result.data }
  } catch (error) {
    console.error('Error searching customer returns:', error)
    return {
      success: false,
      error: 'Failed to search customer returns',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
