'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export interface InstallmentAccountOption {
  id: string
  accountNumber: string
  customerId: string
  customer?: { name: string } | null
  /** Distinct item names sold under this account (POS-originated only;
   * empty for hand-entered/imported accounts) — shown in the repossession
   * picker so a receiver searching by customer can still confirm which
   * item they're looking at before picking the account. */
  itemNames?: string[]
  /** The linked AR invoice number, if any — a receiver with the physical
   * invoice in hand can search by its number instead. */
  invoiceNumber?: string | null
}

interface InstallmentAccountListResponse {
  data: InstallmentAccountOption[]
  meta: { total: number; page: number; limit: number; lastPage: number }
}

/** Scenario 55 Part 4 — the repossession picker on Create RR. `search`
 * matches the account number, the customer's name, the item name, a serial
 * number, or the AR invoice number — a receiver usually knows one of those,
 * not the account number off the top of their head. */
export async function getInstallmentAccounts(params?: {
  search?: string
  /** Scopes the picker to one customer — set once "Repossessed From" is
   * picked, so the account search doesn't have to also disambiguate whose
   * account it is. */
  customerId?: string
  limit?: number
}): Promise<ApiResponse<InstallmentAccountListResponse>> {
  try {
    const result = await api.get<InstallmentAccountListResponse>(
      '/crm/installment-accounts',
      { ...params },
      { tags: ['crm:installment-accounts'] }
    )

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch installment accounts',
        message: result.message,
      }
    }

    return { success: true, data: result.data }
  } catch (error) {
    console.error('Error fetching installment accounts:', error)
    return {
      success: false,
      error: 'Failed to fetch installment accounts',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
