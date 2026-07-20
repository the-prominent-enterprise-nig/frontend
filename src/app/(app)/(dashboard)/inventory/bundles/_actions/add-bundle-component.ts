'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { BundleComponentFormSchema } from '@/src/schema/inventory/bundles'

export async function addBundleComponent(
  bundleItemId: string,
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  const parsed = BundleComponentFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<{ id: string }>(
    `/inventory/items/${bundleItemId}/bundle-components`,
    parsed.data
  )

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Failed to add component',
      message: typeof result.message === 'string' ? result.message : 'Failed to add component',
    }
  }

  revalidatePath('/inventory/items')

  return { success: true, data: result.data, message: 'Component added' }
}
