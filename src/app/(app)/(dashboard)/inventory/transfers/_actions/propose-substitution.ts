'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { ProposeSubstitutionFormSchema } from '@/src/schema/inventory/transfers'

export async function proposeSubstitution(
  id: string,
  lineId: string,
  input: unknown
): Promise<ApiResponse<void>> {
  if (!id || !lineId) {
    return {
      success: false,
      error: 'Invalid transfer or line ID',
      message: 'Transfer ID and line ID are required',
    }
  }

  const parsed = ProposeSubstitutionFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch(
    `/inventory/transfers/${id}/lines/${lineId}/propose-substitution`,
    parsed.data
  )

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to propose substitution',
      message: msg || errStr || 'Failed to propose substitution',
    }
  }

  revalidatePath('/inventory/transfers')

  return { success: true, message: 'Substitution proposed — waiting on the requesting branch' }
}
