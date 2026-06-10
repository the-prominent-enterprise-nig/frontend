'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import { CreateUomFormSchema } from '@/src/schema/inventory/uom'

export async function createUom(input: unknown): Promise<ApiResponse<{ id: string }>> {
  const parsed = CreateUomFormSchema.safeParse(input)
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

  const result = await api.post<{ id: string }>('/inventory/uom', payload)

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to create unit of measure',
      message: msg || errStr || 'Failed to create unit of measure',
    }
  }

  revalidatePath('/inventory/uom')

  return {
    success: true,
    data: result.data,
    message: `Unit "${name}" created successfully`,
  }
}
