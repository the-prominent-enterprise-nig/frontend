'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

type ReceiveInitialUnitInput = {
  warehouseId: string
  dateIn: string
  rr: string
  origin?: string
  price?: number
  serialNumber?: string
}

type ReceiveInitialUnitResult = {
  goodsReceiptId: string
  serialNumberId: string | null
}

export async function receiveInitialUnit(
  itemId: string,
  input: ReceiveInitialUnitInput
): Promise<ApiResponse<ReceiveInitialUnitResult>> {
  const session = await getSessionOrNull()
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

  return {
    success: true,
    data: result.data,
    message: 'Initial stock recorded successfully',
  }
}
