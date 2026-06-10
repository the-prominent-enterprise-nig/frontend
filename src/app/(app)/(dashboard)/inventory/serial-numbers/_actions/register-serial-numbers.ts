'use server'

import { revalidatePath } from 'next/cache'
import { api, type ApiResponse } from '@/src/libs/api/client'
import { RegisterSerialsFormInputSchema } from '@/src/schema/inventory/serial-numbers'

export async function registerSerialNumbers(input: unknown): Promise<ApiResponse<unknown>> {
  const parsed = RegisterSerialsFormInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      message: parsed.error.issues.map((i) => i.message).join(', '),
    }
  }

  const serialNumbers = parsed.data.serialNumbersText
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  if (serialNumbers.length === 0) {
    return {
      success: false,
      error: 'No serial numbers provided',
      message: 'Enter at least one serial number',
    }
  }

  const unique = new Set(serialNumbers)
  if (unique.size !== serialNumbers.length) {
    return {
      success: false,
      error: 'Duplicate serial numbers',
      message: 'Serial numbers in the list must be unique',
    }
  }

  const result = await api.post('/inventory/serial-numbers', {
    itemId: parsed.data.itemId,
    warehouseId: parsed.data.warehouseId,
    serialNumbers,
  })

  if (!result.success) {
    const errStr = Array.isArray(result.error) ? result.error.join(' ') : (result.error ?? '')
    const msg =
      typeof result.message === 'string' ? result.message : JSON.stringify(result.message ?? '')
    return {
      success: false,
      error: errStr || 'Failed to register serial numbers',
      message: msg || errStr || 'Failed to register serial numbers',
    }
  }

  revalidatePath('/inventory/serial-numbers')

  return {
    success: true,
    data: result.data,
    message: `${serialNumbers.length} serial number(s) registered successfully`,
  }
}
