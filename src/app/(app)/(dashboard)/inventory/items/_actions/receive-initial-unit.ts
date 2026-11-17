'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { UnitClassification } from '@/src/schema/inventory/reports'

type ReceiveInitialUnitInput = {
  warehouseId: string
  /** Blank = today. */
  dateIn?: string
  /** Blank = one is generated. */
  rr?: string
  origin?: string
  price?: number
  serialNumber?: string
  /** Several units of the item under the one RR # — Item Master's "Add
   * units". Takes precedence over serialNumber. */
  serialNumbers?: string[]
  /** General Stockbook Classification; the backend defaults to Brand New. */
  classification?: UnitClassification
}

type ReceiveInitialUnitResult = {
  goodsReceiptId: string
  serialNumberId: string | null
  serialNumberIds?: string[]
  /** The RR # used — generated when none was given. */
  rr?: string
}

export async function receiveInitialUnit(
  itemId: string,
  input: ReceiveInitialUnitInput
): Promise<ApiResponse<ReceiveInitialUnitResult>> {
  const session = await getSessionIfAvailable()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to record initial stock',
    }
  }

  const result = await api.post<ReceiveInitialUnitResult>(
    `/inventory/items/${itemId}/receive-initial`,
    input
  )

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to record initial stock',
      message: result.message,
    }
  }

  revalidatePath('/inventory/items')
  revalidatePath('/inventory/serial-numbers')

  const count = input.serialNumbers?.length ?? 1
  return {
    success: true,
    data: result.data,
    message:
      count > 1 ? `${count} units recorded successfully` : 'Initial stock recorded successfully',
  }
}
