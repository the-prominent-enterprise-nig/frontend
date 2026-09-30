'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateTransferFormSchema } from '@/src/schema/inventory/transfers'

export async function createTransfer(
  input: unknown
): Promise<ApiResponse<{ id: string; transferNumber?: string }>> {
  const parsed = CreateTransferFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  // Scenario 50 — a blank Expected Arrival reaches here as parsed.data's
  // own '' default (Zod's .optional() lets an empty string through, it only
  // rejects undefined), and the backend's @IsOptional() + @IsDateString()
  // pair rejects that empty string outright — @IsOptional() only excuses
  // undefined/null, not ''. Strip it here rather than in the schema: a
  // schema-level .transform() breaks zodResolver's type alignment with
  // useForm<CreateTransferFormValues>() (the transform makes the field's
  // inferred type mandatory-but-possibly-undefined instead of omittable,
  // which the resolver's generic can't reconcile without extra ceremony).
  // destinationType/newCaravan are form-only (Scenario 60): the modal has
  // already created any new caravan and put its warehouse in toWarehouseId.
  const data = { ...parsed.data }
  delete data.destinationType
  delete data.newCaravan
  const result = await api.post<{ id: string; transferNumber?: string }>('/inventory/transfers', {
    ...data,
    expectedArrival: data.expectedArrival || undefined,
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create transfer',
      message: msg || errStr || 'Failed to create transfer',
    }
  }

  revalidatePath('/inventory/transfers')

  return {
    success: true,
    data: result.data,
    message: 'Transfer saved as draft',
  }
}
