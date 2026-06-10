'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateCategoryFormSchema } from '@/src/schema/inventory/categories'

export async function createCategory(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const parsed = CreateCategoryFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<{ id: string }>('/inventory/categories', {
    ...parsed.data,
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    const isDuplicate =
      errStr.includes('409') ||
      msg.toLowerCase().includes('already exists') ||
      msg.toLowerCase().includes('duplicate')

    if (isDuplicate) {
      return {
        success: false,
        error: 'duplicate_name',
        message: `A category named "${parsed.data.name}" already exists under the same parent.`,
      }
    }

    return {
      success: false,
      error: errStr || 'Failed to create category',
      message: msg || errStr || 'Failed to create category',
    }
  }

  revalidatePath('/inventory/categories')

  return {
    success: true,
    data: result.data,
    message: 'Category created successfully',
  }
}
