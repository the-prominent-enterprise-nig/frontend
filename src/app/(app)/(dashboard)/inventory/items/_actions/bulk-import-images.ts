'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { revalidatePath } from 'next/cache'
import type { ItemImageFile } from './item-images'

export interface BulkImageMapping {
  sku: string
  fileId: string
  variantId?: string
  sortOrder?: number
  isPrimary?: boolean
}

export interface BulkImportResult {
  imported: number
  skipped: { sku: string; reason: string }[]
  errors: { sku: string; error: string }[]
}

export async function uploadBulkFile(formData: FormData): Promise<ApiResponse<ItemImageFile>> {
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

export async function bulkImportImages(
  mappings: BulkImageMapping[]
): Promise<ApiResponse<BulkImportResult>> {
  const result = await api.post<BulkImportResult>('/inventory/items/images/bulk-import', {
    mappings,
  })

  if (result.success) revalidatePath('/inventory/items')
  return result
}
