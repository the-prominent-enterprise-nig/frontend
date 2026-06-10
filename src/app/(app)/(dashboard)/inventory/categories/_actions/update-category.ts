'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { UpdateCategoryFormSchema } from '@/src/schema/inventory/categories'

export async function updateCategory(
  id: string,
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  const parsed = UpdateCategoryFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch<{ id: string }>(`/inventory/categories/${id}`, parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')

    return {
      success: false,
      error: errStr || 'Failed to update category',
      message: msg || errStr || 'Failed to update category',
    }
  }

  revalidatePath('/inventory/categories')

  return {
    success: true,
    data: result.data,
    message: 'Category updated successfully',
  }
}
