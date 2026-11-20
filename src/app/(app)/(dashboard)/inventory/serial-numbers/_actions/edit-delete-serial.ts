'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { EditSerialFormSchema } from '@/src/schema/inventory/serial-numbers'

const BACKEND_MESSAGES: Record<string, string> = {
  serial_number_already_exists: 'Another unit already has this serial number.',
  serial_number_not_found: 'This unit no longer exists.',
}

/** The backend's own wording (not allowed, still on documents) reads fine as-is. */
function failureMessage(result: ApiResponse<unknown>, fallback: string): string {
  const text = result.message || result.error || ''
  return BACKEND_MESSAGES[text] ?? (text || fallback)
}

/** Business Owner / Head Office only — the backend refuses anyone else. */
export async function editSerialNumber(
  serialId: string,
  input: unknown
): Promise<ApiResponse<unknown>> {
  const parsed = EditSerialFormSchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join(', ')
    return { success: false, error: message, message }
  }
  const result = await api.patch(`/inventory/serial-numbers/${serialId}`, parsed.data)
  if (!result.success) {
    const message = failureMessage(result, 'Failed to update the serial number')
    return { success: false, error: message, message }
  }
  revalidatePath('/inventory/serial-numbers')
  return { success: true, data: result.data, message: 'Serial number updated' }
}

/** Business Owner / Head Office only; refused once the unit appears on any document. */
export async function deleteSerialNumber(serialId: string): Promise<ApiResponse<unknown>> {
  const result = await api.delete(`/inventory/serial-numbers/${serialId}`)
  if (!result.success) {
    const message = failureMessage(result, 'Failed to delete the serial number')
    return { success: false, error: message, message }
  }
  revalidatePath('/inventory/serial-numbers')
  return { success: true, data: result.data, message: 'Serial number deleted' }
}
