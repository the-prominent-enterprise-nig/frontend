'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateBundleFormSchema } from '@/src/schema/inventory/bundles'

export async function createBundle(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const parsed = CreateBundleFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const { components, isSerialTracked, ...itemFields } = parsed.data

  // Step 1: create the item with isBundle=true
  const itemPayload = {
    ...itemFields,
    isBundle: true,
    hasVariants: false,
    isBatchTracked: false,
    isSerialTracked: isSerialTracked ?? false,
    isExpiryTracked: false,
    costingMethod: 'weighted_average' as const,
  }

  const itemResult = await api.post<{ id: string }>('/inventory/items', itemPayload)

  if (!itemResult.success) {
    const errStr = Array.isArray(itemResult.error)
      ? itemResult.error.join(' ')
      : (itemResult.error ?? '')
    const msg =
      typeof itemResult.message === 'string'
        ? itemResult.message
        : JSON.stringify(itemResult.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create bundle item',
      message: msg || errStr || 'Failed to create bundle item',
    }
  }

  const bundleItemId = itemResult.data?.id
  if (!bundleItemId) {
    return {
      success: false,
      error: 'No item ID returned',
      message: 'Bundle item creation returned no ID',
    }
  }

  // Step 2: add each component
  for (const component of components) {
    const compResult = await api.post(`/inventory/items/${bundleItemId}/bundle-components`, {
      componentItemId: component.componentItemId,
      quantityPerBundle: component.quantityPerBundle,
    })

    if (!compResult.success) {
      const errStr = Array.isArray(compResult.error)
        ? compResult.error.join(' ')
        : (compResult.error ?? '')
      return {
        success: false,
        error: errStr || 'Failed to add bundle component',
        message:
          typeof compResult.message === 'string'
            ? compResult.message
            : `Failed to add component for item ${component.componentItemId}`,
      }
    }
  }

  revalidatePath('/inventory/bundles')

  return {
    success: true,
    data: { id: bundleItemId },
    message: `Bundle "${parsed.data.name}" created with ${components.length} component${components.length !== 1 ? 's' : ''}`,
  }
}
