'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { revalidatePath } from 'next/cache'

export interface WriteOffPhotoFile {
  id: string
  originalName: string
  mimeType: string
  size: number
  storageKey: string
  storageType: string
}

export interface WriteOffPhoto {
  id: string
  entityId: string
  entityType: string
  fileId: string
  file: WriteOffPhotoFile
  createdAt: string
}

export async function uploadWriteOffPhoto(
  formData: FormData
): Promise<ApiResponse<WriteOffPhotoFile>> {
  const file = formData.get('file') as File | null
  if (!file) return { success: false, error: 'No file provided', message: 'A file is required' }

  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const authToken = cookieStore.get('authToken')?.value

  const API_URL = (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '')

  const backendForm = new FormData()
  backendForm.append('file', file, file.name)

  try {
    const response = await fetch(`${API_URL}/files/upload`, {
      method: 'POST',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: backendForm,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return {
        success: false,
        error: 'upload_failed',
        message: err.message || `Upload failed with status ${response.status}`,
      }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: 'network_error',
      message: error instanceof Error ? error.message : 'Upload failed',
    }
  }
}

export async function attachWriteOffPhoto(
  adjustmentId: string,
  fileId: string
): Promise<ApiResponse<WriteOffPhoto>> {
  return api.post(`/inventory/adjustments/${adjustmentId}/attachments`, { fileId })
}

export async function listWriteOffPhotos(
  adjustmentId: string
): Promise<ApiResponse<WriteOffPhoto[]>> {
  return api.get(`/inventory/adjustments/${adjustmentId}/attachments`)
}

export async function removeWriteOffPhoto(
  adjustmentId: string,
  attachmentId: string
): Promise<ApiResponse<{ deleted: boolean }>> {
  const result = await api.delete(
    `/inventory/adjustments/${adjustmentId}/attachments/${attachmentId}`
  )
  if (result.success) revalidatePath('/inventory/write-offs')
  return result
}
