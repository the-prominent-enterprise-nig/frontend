'use server'

import { revalidatePath } from 'next/cache'
import { type ApiResponse } from '@/src/libs/api/client'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import type {
  AcknowledgementImportPreview,
  AcknowledgementImportResult,
} from '@/src/schema/pos/acknowledgement-import'
import { humanizeAcknowledgementImportError } from './acknowledgement-import-errors'

async function send<T>(
  path: string,
  formData: FormData,
  extra: Record<string, string>
): Promise<ApiResponse<T>> {
  const session = await getSessionIfAvailable()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, POS_PERMISSIONS.COLLECTIONS_MANAGE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to import receipts',
    }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { success: false, error: 'No file provided', message: 'A CSV file is required' }
  }

  const { cookies } = await import('next/headers')
  const authToken = (await cookies()).get('authToken')?.value
  const apiUrl = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '')

  const body = new FormData()
  body.append('file', file, file.name)
  for (const [key, value] of Object.entries(extra)) body.append(key, value)

  try {
    const response = await fetch(`${apiUrl}/accounting/acknowledgement-receipts/${path}`, {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body,
    })
    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const raw = data?.message
      const message = Array.isArray(raw) ? raw.join(' ') : typeof raw === 'string' ? raw : undefined
      return {
        success: false,
        error: 'import_failed',
        message:
          humanizeAcknowledgementImportError(message) ??
          `Upload failed with status ${response.status}`,
      }
    }
    if (!data || typeof data !== 'object') {
      return {
        success: false,
        error: 'invalid_response',
        message: 'Unexpected response from server',
      }
    }
    return { success: true, data: data as T }
  } catch (error) {
    return {
      success: false,
      error: 'network_error',
      message: error instanceof Error ? error.message : 'Upload failed',
    }
  }
}

/** Dry run — reads the CSV and reports what each row would do. Writes nothing.
 * FormData fields: `file`. */
export async function previewAcknowledgementReceiptImport(
  formData: FormData
): Promise<ApiResponse<AcknowledgementImportPreview>> {
  return send<AcknowledgementImportPreview>('import/preview', formData, {})
}

/** The real import — re-sends the same file once the user has read the
 * preview. FormData field: `file`. */
export async function commitAcknowledgementReceiptImport(
  formData: FormData
): Promise<ApiResponse<AcknowledgementImportResult>> {
  const res = await send<AcknowledgementImportResult>('import', formData, {})
  if (res.success) revalidatePath('/pos/collections/acknowledgement')
  return res
}
