'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { CreateBarcodeFormSchema } from '@/src/schema/inventory/barcodes'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function createBarcode(itemId: string, input: unknown): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.BARCODES_MANAGE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to manage barcodes',
    }
  }

  const parsed = CreateBarcodeFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post(`/inventory/items/${itemId}/barcodes`, parsed.data)
  if (!result.success) {
    return {
      success: false,
      error: typeof result.error === 'string' ? result.error : 'Failed to create barcode',
      message: typeof result.message === 'string' ? result.message : 'Failed to create barcode',
    }
  }

  return { success: true, data: result.data, message: 'Barcode added successfully' }
}
