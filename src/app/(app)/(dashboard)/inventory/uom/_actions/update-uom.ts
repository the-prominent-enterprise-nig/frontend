'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { UpdateUomFormSchema } from '@/src/schema/inventory/uom'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'

export async function updateUom(id: string, input: unknown): Promise<ApiResponse<void>> {
  if (!id) return { success: false, error: 'ID required', message: 'UOM ID is required' }

  const session = await getSessionOrNull()
  if (!session) return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  if (!can(session, INVENTORY_PERMISSIONS.UOM_UPDATE)) {
    return {
      success: false,
      error: 'Forbidden',
      message: 'You do not have permission to update units of measure',
    }
  }

  const parsed = UpdateUomFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const { code, name, isBaseUnit, allowDecimal, baseUnitId, conversionFactor } = parsed.data

  const payload: Record<string, unknown> = {
    code: code.toUpperCase(),
    name,
    isBaseUnit,
    allowDecimal: allowDecimal ?? false,
  }
  if (!isBaseUnit) {
    payload.baseUnitId = baseUnitId
    payload.conversionFactor = conversionFactor
  }

  const result = await api.patch(`/inventory/uom/${id}`, payload)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to update unit of measure',
      message: msg || errStr || 'Failed to update unit of measure',
    }
  }

  revalidatePath('/inventory/uom')

  return { success: true, message: `Unit "${name}" updated successfully` }
}
