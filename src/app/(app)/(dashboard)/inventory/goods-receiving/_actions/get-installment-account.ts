'use server'

import { api, ApiResponse } from '@/src/libs/api/client'

export interface InstallmentAccountUnitItem {
  id: string
  itemId: string
  itemName: string | null
  modelNumber: string | null
  brand: string | null
  serialNumberId: string | null
  serialNumber: string | null
  secondarySerialNumberId: string | null
  secondarySerialNumber: string | null
  /** What this unit was actually sold at (CostingService.computeCogs(),
   * captured at sale time) — a repossessed unit re-enters stock at this
   * same cost rather than the receiver guessing or typing one. Null for a
   * pre-cost-tracking sale, same as any other historical gap. */
  unitCost: number | null
  /** What the unit re-enters stock at: LCP - total payments (monthly + down
   * payment) + agent commission (skipped when the agent is Office), split
   * across the account's units by listed-price share. Can be <= 0 on a
   * fully-paid account, in which case the receiver types a cost. */
  repoCost: number
  /** SerialNumber.status as of right now — 'sold' means still out with the
   * customer; anything else (most likely 'in_stock', once a prior
   * repossession already brought it back) means this specific unit isn't
   * available to repossess again. The repossession picker filters on this;
   * left in the array (not filtered server-side) because this same
   * endpoint also backs the customer ledger view, which wants the full
   * sale history, repossessed units included. */
  serialStatus: string | null
}

export interface InstallmentAccountDetailOption {
  id: string
  accountNumber: string
  customerId: string
  customer?: { name: string } | null
  /** Resolved from the linked InstallmentSchedule's PosTransactionLines —
   * always empty for a hand-entered/imported account (no linked schedule).
   * The repossession picker on Create RR reads this to auto-fill (or, when
   * there's more than one, let the receiver pick) the item/serial a line's
   * unit is being repossessed from. */
  unitItems: InstallmentAccountUnitItem[]
}

/** Repossession picker (Create RR), the step after an account is picked:
 * fetches its own sold unit(s) so the item and serial can be shown rather
 * than asked for. */
export async function getInstallmentAccount(
  id: string
): Promise<ApiResponse<InstallmentAccountDetailOption>> {
  try {
    const result = await api.get<InstallmentAccountDetailOption>(`/crm/installment-accounts/${id}`)

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || 'Failed to fetch installment account',
        message: result.message,
      }
    }

    return { success: true, data: result.data }
  } catch (error) {
    console.error('Error fetching installment account:', error)
    return {
      success: false,
      error: 'Failed to fetch installment account',
      message: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
