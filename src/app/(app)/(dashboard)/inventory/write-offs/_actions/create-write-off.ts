'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateWriteOffFormSchema } from '@/src/schema/inventory/write-offs'

export async function createWriteOff(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const parsed = CreateWriteOffFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const payload = {
    ...parsed.data,
  }

  const result = await api.post<{ id: string }>('/inventory/adjustments/write-off', payload)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to record write-off',
      message: msg || errStr || 'Failed to record write-off',
    }
  }

  revalidatePath('/inventory/write-offs')

  return {
    success: true,
    data: result.data,
    message: 'Write-off recorded and expense posted to Inventory Loss account',
  }
}
