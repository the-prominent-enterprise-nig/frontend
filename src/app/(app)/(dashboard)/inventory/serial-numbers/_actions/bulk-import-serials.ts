'use server'

import { revalidatePath } from 'next/cache'
import { type ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import {
  SerializedImportResultSchema,
  type SerializedImportResult,
} from '@/src/schema/inventory/serial-numbers/bulk-import'

export async function bulkImportSerials(
  formData: FormData
): Promise<ApiResponse<SerializedImportResult>> {
  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.SERIAL_MANAGE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to import serialized inventory',
    }
  }

  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'No file provided', message: 'A CSV file is required' }
  const warehouseId = formData.get('warehouseId') as string | null
  if (!warehouseId) {
    return { success: false, error: 'No warehouse selected', message: 'A warehouse is required' }
  }
  const dryRun = formData.get('dryRun') === 'true'

  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const authToken = cookieStore.get('authToken')?.value

  const API_URL = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '')

  const backendForm = new FormData()
  backendForm.append('file', file, file.name)
  backendForm.append('warehouseId', warehouseId)
  backendForm.append('dryRun', String(dryRun))

  try {
    const response = await fetch(`${API_URL}/inventory/serial-numbers/bulk-import`, {
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

    const parsed = SerializedImportResultSchema.safeParse(data)
    if (!parsed.success) {
      return {
        success: false,
        error: 'invalid_response',
        message: 'Unexpected response from server',
      }
    }

    if (!parsed.data.dryRun && parsed.data.created > 0) {
      revalidatePath('/inventory/serial-numbers')
      revalidatePath('/inventory/items')
      revalidatePath('/inventory/catalog')
    }

    const skippedNote = parsed.data.skippedBlankRows
      ? `, ${parsed.data.skippedBlankRows} blank row(s) skipped`
      : ''

    return {
      success: true,
      data: parsed.data,
      message: parsed.data.dryRun
        ? `Preview: ${parsed.data.created} row(s) importable, ${parsed.data.errors.length} error(s)${skippedNote}`
        : `${parsed.data.created} unit(s) imported, ${parsed.data.errors.length} row(s) failed${skippedNote}`,
    }
  } catch (error) {
    return {
      success: false,
      error: 'network_error',
      message: error instanceof Error ? error.message : 'Import failed',
    }
  }
}
