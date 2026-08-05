'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function deleteBrand(id: string): Promise<ApiResponse<void>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_MANAGE_CLASSIFICATION)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to manage item classification',
    }
  }

  const result = await api.delete<void>(`/inventory/classification/brands/${id}`)

  if (!result.success) {
    return {
      success: false,
      error: result.error || 'Failed to delete brand',
      message: result.message || 'Failed to delete brand',
    }
  }

  revalidatePath('/inventory/catalog')

  return { success: true, message: 'Brand deleted successfully' }
}
