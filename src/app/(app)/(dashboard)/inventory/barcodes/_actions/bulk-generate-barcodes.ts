'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import { BulkGenerateFormSchema } from '@/src/schema/inventory/barcodes'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function bulkGenerateBarcodes(input: unknown): Promise<ApiResponse<unknown>> {
  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.BARCODES_MANAGE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to manage barcodes',
    }
  }

  const parsed = BulkGenerateFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post('/inventory/items/barcodes/bulk-generate', parsed.data)
  if (!result.success) {
    return {
      success: false,
      error: typeof result.error === 'string' ? result.error : 'Failed to bulk generate barcodes',
      message:
        typeof result.message === 'string' ? result.message : 'Failed to bulk generate barcodes',
    }
  }

  return { success: true, data: result.data, message: 'Barcodes generated successfully' }
}
