'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { NewCaravanFormSchema } from '@/src/schema/inventory/transfers'

// Scenario 60 — a caravan's details edited from Edit Request, alongside the
// request going to it. Same fields as createCaravan.
export async function updateCaravan(
  caravanId: string,
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  const parsed = NewCaravanFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch<{ id: string }>(`/inventory/caravans/${caravanId}`, {
    ...parsed.data,
    eventName: parsed.data.eventName.trim(),
    // '' clears a location the user removed; undefined would leave it as is.
    location: parsed.data.location?.trim() ?? '',
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update the caravan',
      message: msg || errStr || 'Failed to update the caravan',
    }
  }

  revalidatePath('/inventory/transfers')
  return { success: true, data: result.data, message: 'Caravan updated' }
}
