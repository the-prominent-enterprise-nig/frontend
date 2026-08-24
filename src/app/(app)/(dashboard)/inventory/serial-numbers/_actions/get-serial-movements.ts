'use server'

import { api, ApiResponse } from '@/src/libs/api/client'
import {
  SerialMovementsResponseSchema,
  type SerialMovementsResponse,
} from '@/src/schema/inventory/serial-numbers'

export async function getSerialMovements(
  serialId: string
): Promise<ApiResponse<SerialMovementsResponse>> {
  const result = await api.get<SerialMovementsResponse>(
    `/inventory/serial-numbers/${serialId}/movements`
  )

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'Failed to fetch serial movements',
      message: result.message,
    }
  }

  const validated = SerialMovementsResponseSchema.safeParse(result.data)
  if (!validated.success) {
    return { success: true, data: result.data as SerialMovementsResponse }
  }

  return { success: true, data: validated.data }
}
