'use server'

import { revalidatePath } from 'next/cache'
import { api } from '@/src/libs/api/client'

export async function createEmployee(input: unknown) {
  const result = await api.post('/users', input)

  if (!result.success) {
    return {
      success: false as const,
      error: result.error ?? 'Failed to create user',
      message: result.message,
    }
  }

  revalidatePath('/settings/users')

  return { success: true as const, data: result.data, message: result.message }
}
