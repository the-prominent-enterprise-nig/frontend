'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { DriverFormSchema } from '@/src/schema/inventory/vehicles'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

function failure(result: { error?: unknown; message?: unknown }, fallback: string) {
  const errStr = Array.isArray(result.error) ? result.error.join(' ') : String(result.error ?? '')
  const msg =
    typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
  return { success: false as const, error: errStr || fallback, message: msg || errStr || fallback }
}

// Create (no id) or update (id). An emptied contact/tag is sent as '' so the
// backend clears it; an empty branch is dropped (head office picks one, a
// branch-assigned user is forced into their own server-side).
export async function saveDriver(id: string | null, input: unknown): Promise<ApiResponse<void>> {
  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  const needed = id ? INVENTORY_PERMISSIONS.DRIVERS_UPDATE : INVENTORY_PERMISSIONS.DRIVERS_CREATE
  if (!can(session, needed)) {
    return {
      success: false,
      error: 'Forbidden',
      message: `You do not have permission to ${id ? 'edit' : 'add'} drivers`,
    }
  }

  const parsed = DriverFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const { branchId, ...rest } = parsed.data
  const body = {
    ...rest,
    contactNumber: rest.contactNumber ?? '',
    tag: rest.tag ?? '',
    ...(branchId ? { branchId } : {}),
  }

  const result = id
    ? await api.patch(`/inventory/vehicles/drivers/${id}`, body)
    : await api.post('/inventory/vehicles/drivers', body)
  if (!result.success) return failure(result, 'Failed to save driver')

  revalidatePath('/inventory/master-data')
  return { success: true, message: id ? 'Driver updated' : 'Driver added' }
}
