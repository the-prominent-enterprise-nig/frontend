'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { NewCaravanFormSchema } from '@/src/schema/inventory/transfers'

type CreatedCaravan = { id: string; warehouseId: string }

// Scenario 60 Part 2 — a caravan is a temporary branch hosted at a real
// branch for an event. Created from New Stock Transfer, then used straight
// away as the transfer's destination via its warehouseId.
export async function createCaravan(input: unknown): Promise<ApiResponse<CreatedCaravan>> {
  const parsed = NewCaravanFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.post<CreatedCaravan>('/inventory/caravans', {
    ...parsed.data,
    eventName: parsed.data.eventName.trim(),
    location: parsed.data.location?.trim() || undefined,
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create the caravan',
      message: msg || errStr || 'Failed to create the caravan',
    }
  }

  revalidatePath('/inventory/transfers')
  return { success: true, data: result.data, message: 'Caravan created' }
}
