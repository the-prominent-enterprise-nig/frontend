'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { ConfirmSubstitutionFormSchema } from '@/src/schema/inventory/transfers'

export async function confirmSubstitution(
  id: string,
  lineId: string,
  input: unknown
): Promise<ApiResponse<{ status: string }>> {
  if (!id || !lineId) {
    return {
      success: false,
      error: 'Invalid transfer or line ID',
      message: 'Transfer ID and line ID are required',
    }
  }

  const parsed = ConfirmSubstitutionFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch<{ status: string }>(
    `/inventory/transfers/${id}/lines/${lineId}/confirm-substitution`,
    parsed.data
  )

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to confirm substitution',
      message: msg || errStr || 'Failed to confirm substitution',
    }
  }

  revalidatePath('/inventory/transfers')

  return {
    success: true,
    data: { status: result.data?.status ?? '' },
    message:
      parsed.data.decision === 'accept'
        ? 'Substitution accepted — request re-entered approval routing'
        : 'Substitution rejected — request kept as originally raised',
  }
}
