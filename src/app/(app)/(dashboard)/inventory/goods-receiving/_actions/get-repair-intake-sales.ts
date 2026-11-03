'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import type { InstallmentAccountUnitItem } from './get-installment-account'

/** A sale a repair/return unit could have been sold on — cash or financed. */
export interface RepairIntakeSale {
  id: string
  /** The Sales Invoice No. the customer holds, else the POS number. */
  siNumber: string
  transactionNumber: string
  occurredAt: string
  /** Fills Returned by and Customer ID once picked. Null for a walk-in sale. */
  customer: { id: string; name: string; customerCode: string } | null
  /** Same shape as an installment account's units, so the panel lists and
   * checks them the same way. */
  unitItems: InstallmentAccountUnitItem[]
}

/** The Invoice # picker on a Repair/Return RR. `search` matches the SI No.,
 * the POS number, the customer's name or code, an item, or a serial; only
 * sales with a unit still out with the customer come back. */
export async function getRepairIntakeSales(params: {
  search?: string
  /** Scopes the search to one customer — set once Returned by is picked. */
  customerId?: string
}): Promise<ApiResponse<RepairIntakeSale[]>> {
  try {
    const result = await api.get<RepairIntakeSale[]>('/inventory/stock/repair-intake-sales', {
      ...params,
    })

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to search sales',
        message: result.message,
      }
    }

    return { success: true, data: result.data }
  } catch (error) {
    console.error('Error searching repair intake sales:', error)
    return {
      success: false,
      error: 'Failed to search sales',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
