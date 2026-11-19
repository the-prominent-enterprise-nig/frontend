'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { UnitClassification } from '@/src/schema/inventory/reports'

/** One branch's opening stock — its own receipt. */
export type BranchInput = {
  warehouseId: string
  /** Blank = one is generated. */
  rr?: string
  /** Blank = today. */
  dateIn?: string
  /** Blank = WHSE (internal stock). */
  origin?: string
  price?: number
  /** Serial item: this branch's units, one serial each. */
  serialNumbers?: string[]
  /** Serial item: the units' Stockbook Classification (blank = Brand New). */
  classification?: UnitClassification
  /** Non-serial item: how much, in `unitId` — blank = the item's base unit,
   * or one built on it (SACK = 5 KG), which the backend converts. */
  quantity?: number
  unitId?: string
}

type ReceiveAtBranchesResult = {
  receipts: { warehouseId: string; goodsReceiptId: string; rr: string; serialNumberIds: string[] }[]
}

async function denied(): Promise<ApiResponse<never> | null> {
  const session = await getSessionIfAvailable()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to record initial stock',
    }
  }
  return null
}

/** Item Master → Add units: an item's opening stock at one or more
 * branches — all recorded, or none (the backend writes them in one go). */
export async function receiveInitialAtBranches(
  itemId: string,
  input: { branches: BranchInput[] }
): Promise<ApiResponse<ReceiveAtBranchesResult>> {
  const refusal = await denied()
  if (refusal) return refusal
  const result = await api.post<ReceiveAtBranchesResult>(
    `/inventory/items/${itemId}/receive-initial-branches`,
    input
  )
  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to record the units',
      message: result.message,
    }
  }
  revalidatePath('/inventory/items')
  revalidatePath('/inventory/serial-numbers')
  return { success: true, data: result.data, message: successMessage(input.branches) }
}

function successMessage(branches: BranchInput[]): string {
  const n = branches.length
  const where = `${n} branch${n === 1 ? '' : 'es'}`
  const units = branches.reduce((sum, b) => sum + (b.serialNumbers?.length ?? 0), 0)
  return units > 0
    ? `${units} unit${units === 1 ? '' : 's'} recorded at ${where}`
    : `Recorded on hand at ${where}`
}
