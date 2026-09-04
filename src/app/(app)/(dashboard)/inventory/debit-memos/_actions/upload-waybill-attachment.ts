'use server'

import { cookies } from 'next/headers'
import type { ApiResponse } from '@/src/libs/api/client'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { FILES_PERMISSIONS } from '@/src/libs/guards/files-permissions'

export interface UploadedFile {
  id: string
  originalName: string
  mimeType: string
  size: number
}

/**
 * Scenario 46 — uploads the waybill photo for a supplier debit memo. Same
 * shape as uploadVoucherAttachment(): the `api` client is JSON-only, so
 * multipart has to go through a server action that proxies straight to the
 * backend. The caller still POSTs /file-attachments separately to link the
 * returned file id to the memo — that call is plain JSON, so it stays
 * client-side via the AccountingV2Data FileAttachments client.
 */
export async function uploadWaybillAttachment(
  formData: FormData
): Promise<ApiResponse<UploadedFile>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!can(session, FILES_PERMISSIONS.FILES_CREATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to upload files',
    }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return { success: false, error: 'No file provided', message: 'No file provided' }
  }

  const cookieStore = await cookies()
  const authToken = cookieStore.get('authToken')?.value
  const apiUrl = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')

  const upstreamForm = new FormData()
  upstreamForm.set('file', file, file.name)

  try {
    const response = await fetch(`${apiUrl}/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: upstreamForm,
      signal: AbortSignal.timeout(30_000),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const message = Array.isArray(body.message) ? body.message.join(' ') : body.message
      return {
        success: false,
        error: message || 'Failed to upload file',
        message: message || `Upload failed with status ${response.status}`,
      }
    }

    const data = (await response.json()) as UploadedFile
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: 'Network error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    }
  }
}
