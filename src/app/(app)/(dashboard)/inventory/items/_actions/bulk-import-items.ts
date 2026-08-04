'use server'

import { revalidatePath } from 'next/cache'
import { type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import {
  BulkImportItemsResultSchema,
  type BulkImportItemsResult,
} from '@/src/schema/inventory/items/bulk-import'

export async function bulkImportItems(
  formData: FormData
): Promise<ApiResponse<BulkImportItemsResult>> {
  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to create items',
    }
  }

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'No file provided', message: 'A CSV file is required' }

  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const authToken = cookieStore.get('authToken')?.value

  const API_URL = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '')

  const backendForm = new FormData()
  backendForm.append('file', file, file.name)

  try {
    const response = await fetch(`${API_URL}/inventory/items/bulk-import`, {
      method: 'POST',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: backendForm,
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        success: false,
        error: 'import_failed',
        message:
          (data && typeof data.message === 'string' && data.message) ||
          `Import failed with status ${response.status}`,
      }
    }

    const parsed = BulkImportItemsResultSchema.safeParse(data)
    if (!parsed.success) {
      return {
        success: false,
        error: 'invalid_response',
        message: 'Unexpected response from server',
      }
    }

    if (parsed.data.created.length > 0) revalidatePath('/inventory/items')

    return {
      success: true,
      data: parsed.data,
      message: `${parsed.data.created.length} item(s) created, ${parsed.data.errors.length} row(s) failed`,
    }
  } catch (error) {
    return {
      success: false,
      error: 'network_error',
      message: error instanceof Error ? error.message : 'Import failed',
    }
  }
}
