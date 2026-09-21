'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export interface InstallmentAccountOption {
  id: string
  accountNumber: string
  customerId: string
  customer?: { name: string } | null
}

interface InstallmentAccountListResponse {
  data: InstallmentAccountOption[]
  meta: { total: number; page: number; limit: number; lastPage: number }
}

/** Scenario 55 Part 4 — the repossession picker on Create RR. `search`
 * matches both the account number and the customer's name. */
export async function getInstallmentAccounts(params?: {
  search?: string
  /** Scenario 55 Part 4 — auto-resolving an account from a repossessed
   * serial's soldToCustomerId. */
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
