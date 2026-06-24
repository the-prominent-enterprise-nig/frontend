'use server'

import { api, type ApiResponse } from '@/src/libs/api/client'
import type { PaginatedResponse, PurchaseOrder } from '@/src/schema/procurement/types'
import { getSessionOrNull } from '@/src/libs/auth/actions'

export async function getPurchaseOrders(): Promise<ApiResponse<PaginatedResponse<PurchaseOrder>>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }

  return api.get<PaginatedResponse<PurchaseOrder>>('/procurement/purchase-orders', {
    limit: 200,
  })
}

export async function getPurchaseOrderById(id: string): Promise<ApiResponse<PurchaseOrder>> {
  const session = await getSessionOrNull()
  if (!session) {
    return { success: false, error: 'Unauthorized', message: 'Authentication required' }
  }

  return api.get<PurchaseOrder>(`/procurement/purchase-orders/${id}`)
}
