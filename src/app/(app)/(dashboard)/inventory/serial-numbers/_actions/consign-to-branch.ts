'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import type { ConsignToBranchFormValues } from '@/src/schema/inventory/serial-numbers'

// Scenario 08 (Caravan) Part 1 — consign serials to a host branch for a
// caravan event. Location moves; ownership stays with the origin branch.
export async function consignToBranch(
  serialNumberIds: string[],
  data: ConsignToBranchFormValues
): Promise<ApiResponse<unknown>> {
  const result = await api.post('/inventory/serial-numbers/consign', {
    serialNumberIds,
    hostBranchId: data.hostBranchId,
    ...(data.eventName && { eventName: data.eventName }),
    ...(data.eventStartDate && { eventStartDate: data.eventStartDate }),
    ...(data.eventEndDate && { eventEndDate: data.eventEndDate }),
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to consign to branch',
      message: msg || errStr || 'Failed to consign to branch',
    }
  }

  revalidatePath('/inventory/serial-numbers')

  return {
    success: true,
    data: result.data,
    message: 'Consigned to branch',
  }
}
