'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { api } from '@/src/libs/api/client'

export async function createEmployee(input: unknown) {
  const result = await api.post('/human-resource/employees', input)

  if (!result.success) {
    return {
      success: false as const,
      error: result.error ?? 'Failed to create employee',
      message: result.message,
    }
  }

  revalidatePath('/human-resource/employees')
  revalidateTag('employees', 'max')

  return { success: true as const, data: result.data, message: result.message }
}
