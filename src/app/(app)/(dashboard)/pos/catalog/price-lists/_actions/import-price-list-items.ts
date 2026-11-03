'use server'

import { revalidatePath } from 'next/cache'
import { type ApiResponse } from '@/src/libs/api/client'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import {
  PriceListImportResultSchema,
  type PriceListImportResult,
} from '@/src/schema/inventory/price-lists/import'
import { humanizePriceListError } from '../_lib/humanize-error'

/** Uploads a price list CSV. FormData fields: `file`, `dryRun` ('true'
 * previews what would change and writes nothing; the real upload re-sends the
 * same file with 'false'), and optionally `priceListId` — present: every row
 * goes into that one list; absent: each row goes to the list for its own
 * PRICE USE. Goes straight to the backend
 * (not the api client) because the body is multipart, same as the item
 * catalog's bulk import. */
export async function importPriceListItems(
  formData: FormData
): Promise<ApiResponse<PriceListImportResult>> {
  const session = await getSessionIfAvailable()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.PRICE_LISTS_UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to edit price list items',
    }
  }

  const file = formData.get('file')
  const priceListId = String(formData.get('priceListId') ?? '')
  const dryRun = formData.get('dryRun') !== 'false'
  if (!(file instanceof File)) {
    return { success: false, error: 'No file provided', message: 'A CSV file is required' }
  }

  const { cookies } = await import('next/headers')
  const authToken = (await cookies()).get('authToken')?.value
  const apiUrl = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '')

  const body = new FormData()
  body.append('file', file, file.name)

  try {
    const response = await fetch(
      `${apiUrl}/inventory/price-lists/${priceListId ? `${encodeURIComponent(priceListId)}/` : ''}import?dryRun=${dryRun}`,
      {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body,
      }
    )
    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const raw = data && typeof data.message === 'string' ? data.message : undefined
      return {
        success: false,
        error: 'import_failed',
        message: humanizePriceListError(raw) ?? `Upload failed with status ${response.status}`,
      }
    }

    const parsed = PriceListImportResultSchema.safeParse(data)
    if (!parsed.success) {
      return {
        success: false,
        error: 'invalid_response',
        message: 'Unexpected response from server',
      }
    }

    if (!dryRun) {
      revalidatePath('/pos/catalog/price-lists')
      if (priceListId) revalidatePath(`/pos/catalog/price-lists/${priceListId}`)
    }
    return {
      success: true,
      data: parsed.data,
      message: dryRun ? 'Preview ready' : 'Upload complete',
    }
  } catch (error) {
    return {
      success: false,
      error: 'network_error',
      message: error instanceof Error ? error.message : 'Upload failed',
    }
  }
}
