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
 * Uploads an expense supporting document (official receipt, sales invoice,
 * billing statement, approval memo) straight to the backend, bypassing the
 * JSON-only `api` client the same way uploadVoucherAttachment() and
 * uploadWaybillAttachment() do.
 *
 * Linking the returned file id to the expense is a separate plain-JSON
 * POST /file-attachments, so that half stays client-side through the
 * AccountingV2Data FileAttachments client.
 */
export async function uploadExpenseAttachment(
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
