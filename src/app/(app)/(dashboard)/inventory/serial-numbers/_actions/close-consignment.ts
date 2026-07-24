'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'

// Scenario 08 (Caravan) Part 5 — event close. Omit targetBranchId to return
// to origin (clears the consignment entirely); provide it to move the
// consignment onward to a new host branch instead.
export async function closeConsignment(
  serialNumberIds: string[],
  targetBranchId?: string
): Promise<ApiResponse<unknown>> {
  const result = await api.post('/inventory/serial-numbers/close-consignment', {
    serialNumberIds,
    ...(targetBranchId && { targetBranchId }),
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to close consignment',
      message: msg || errStr || 'Failed to close consignment',
    }
  }

  revalidatePath('/inventory/serial-numbers')

  return {
    success: true,
    data: result.data,
    message: targetBranchId ? 'Consignment moved onward' : 'Consignment returned to origin',
  }
}
