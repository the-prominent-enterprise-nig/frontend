'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'

export async function removeBundleComponent(
  bundleItemId: string,
  componentId: string
): Promise<ApiResponse<null>> {
  const result = await api.delete(
    `/inventory/items/${bundleItemId}/bundle-components/${componentId}`
  )

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to remove component',
      message: typeof result.message === 'string' ? result.message : 'Failed to remove component',
    }
  }

  revalidatePath('/inventory/items')

  return { success: true, data: null, message: 'Component removed' }
}
