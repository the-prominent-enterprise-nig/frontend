'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  BundleComponentsResponse,
  BundleComponentsResponseSchema,
} from '@/src/schema/inventory/bundles'

export async function getBundleComponents(
  bundleItemId: string
): Promise<ApiResponse<BundleComponentsResponse>> {
  const result = await api.get<BundleComponentsResponse>(
    `/inventory/items/${bundleItemId}/bundle-components`
  )

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to load bundle components',
      message:
        typeof result.message === 'string' ? result.message : 'Failed to load bundle components',
    }
  }

  const parsed = BundleComponentsResponseSchema.safeParse(result.data)
  if (!parsed.success) {
    return { success: true, data: result.data }
  }

  return { success: true, data: parsed.data }
}
