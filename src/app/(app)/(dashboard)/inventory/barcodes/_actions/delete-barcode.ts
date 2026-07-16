'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function deleteBarcode(
  itemId: string,
  barcodeId: string
): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.BARCODES_MANAGE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to manage barcodes',
    }
  }

  const result = await api.delete(`/inventory/items/${itemId}/barcodes/${barcodeId}`)
  if (!result.success) {
    return {
      success: false,
      error: typeof result.error === 'string' ? result.error : 'Failed to delete barcode',
      message: typeof result.message === 'string' ? result.message : 'Failed to delete barcode',
    }
  }

  revalidatePath('/inventory/barcodes')
  return { success: true, data: result.data, message: 'Barcode deleted successfully' }
}
