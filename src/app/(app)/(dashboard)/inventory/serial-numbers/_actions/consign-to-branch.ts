'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import type { ConsignToBranchFormValues } from '@/src/schema/inventory/serial-numbers'

// Scenario 08 (Caravan) Part 1 — consign serials for a caravan event, either
// to a host branch (which then sells them) or to a venue that isn't a branch
// at all. Either way location moves and ownership stays with the origin
// branch; only a host branch gains the right to sell.
export async function consignToBranch(
  serialNumberIds: string[],
  data: ConsignToBranchFormValues
): Promise<ApiResponse<unknown>> {
  const result = await api.post('/inventory/serial-numbers/consign', {
    serialNumberIds,
    // The backend takes exactly one of these; destinationKind is a
    // form-only field deciding which, and is never sent.
    ...(data.destinationKind === 'venue'
      ? { venue: data.venue?.trim() }
      : { hostBranchId: data.hostBranchId }),
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
      error: errStr || 'Failed to consign these units',
      message: msg || errStr || 'Failed to consign these units',
    }
  }

  revalidatePath('/inventory/serial-numbers')

  return {
    success: true,
    data: result.data,
    message: data.destinationKind === 'venue' ? 'Consigned out' : 'Consigned to branch',
  }
}
