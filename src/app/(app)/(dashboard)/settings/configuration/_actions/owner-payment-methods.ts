'use server'

import { revalidatePath } from 'next/cache'
import { api, ApiResponse } from '@/src/libs/api/client'
import type {
  OwnerPaymentMethod,
  OwnerPaymentMethodsResponse,
  PosPaymentMethod,
} from '@/src/schema/pos'

export async function getOwnerPaymentMethods(): Promise<{
  success: boolean
  data?: OwnerPaymentMethod[]
  error?: string
}> {
  try {
    const response = await api.get<OwnerPaymentMethodsResponse>('/pos/payment-methods')
    if (!response.success || !response.data) {
      return { success: false, error: response.error || 'Failed to load payment methods' }
    }
    return { success: true, data: response.data.data }
  } catch {
    return { success: false, error: 'Failed to load payment methods' }
  }
}

export async function saveOwnerPaymentMethods(
  changes: { method: PosPaymentMethod; isEnabled: boolean }[]
): Promise<ApiResponse> {
  try {
    const response = await api.patch('/pos/payment-methods', { changes })
    if (!response.success) {
      return { success: false, error: response.error || 'Failed to save payment methods' }
    }
    revalidatePath('/settings/configuration')
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to save payment methods' }
  }
}
