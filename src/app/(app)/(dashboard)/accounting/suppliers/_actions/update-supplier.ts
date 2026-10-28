'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { UpdateSupplierServerSchema } from '@/src/schema/inventory/suppliers'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { SUPPLIER_ACCESS } from '@/src/libs/guards/shared-ownership'

export async function updateSupplier(
  id: string,
  input: unknown
): Promise<ApiResponse<{ id: string }>> {
  const session = await getSessionIfAvailable()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }
  if (!canAny(session, SUPPLIER_ACCESS.UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to update suppliers',
    }
  }

  const parsed = UpdateSupplierServerSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const result = await api.patch<{ id: string }>(`/suppliers/${id}`, parsed.data)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update supplier',
      message: msg || errStr || 'Failed to update supplier',
    }
  }

  revalidatePath('/accounting/suppliers')

  return {
    success: true,
    data: result.data,
    message: 'Supplier updated successfully',
  }
}
