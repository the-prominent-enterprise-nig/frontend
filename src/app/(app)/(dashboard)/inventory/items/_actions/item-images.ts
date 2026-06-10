'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import { revalidatePath } from 'next/cache'

export interface ItemImageFile {
  id: string
  originalName: string
  mimeType: string
  size: number
  storageKey: string
  storageType: string
}

export interface ItemImage {
  id: string
  itemId: string
  variantId: string | null
  fileId: string
  sortOrder: number
  isPrimary: boolean
  createdAt: string
  file: ItemImageFile
}

export interface VariantImagesResponse {
  source: 'variant' | 'item'
  images: ItemImage[]
}

export async function uploadItemFile(formData: FormData): Promise<ApiResponse<ItemImageFile>> {
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

export async function listItemImages(itemId: string): Promise<ApiResponse<ItemImage[]>> {
  return api.get(`/inventory/items/${itemId}/images`)
}

export async function addItemImage(
  itemId: string,
  dto: { fileId: string; variantId?: string; sortOrder?: number; isPrimary?: boolean }
): Promise<ApiResponse<ItemImage>> {
  const result = await api.post(`/inventory/items/${itemId}/images`, dto)
  if (result.success) revalidatePath('/inventory/items')
  return result
}

export async function updateItemImage(
  itemId: string,
  imageId: string,
  dto: { sortOrder?: number; isPrimary?: boolean }
): Promise<ApiResponse<ItemImage>> {
  const result = await api.patch(`/inventory/items/${itemId}/images/${imageId}`, dto)
  if (result.success) revalidatePath('/inventory/items')
  return result
}

export async function removeItemImage(
  itemId: string,
  imageId: string
): Promise<ApiResponse<{ deleted: boolean }>> {
  const result = await api.delete(`/inventory/items/${itemId}/images/${imageId}`)
  if (result.success) revalidatePath('/inventory/items')
  return result
}

export async function getVariantImages(
  itemId: string,
  variantId: string
): Promise<ApiResponse<VariantImagesResponse>> {
  return api.get(`/inventory/items/${itemId}/variants/${variantId}/images`)
}
