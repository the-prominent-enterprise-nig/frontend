'use server'

import { api } from '@/src/libs/api/client'

export async function updateTableStatus(tableId: string, status: string) {
  const result = await api.patch(`/queue-management/tables/${tableId}/status`, { status })
  if (!result.success) return { success: false as const, error: result.error }
  return { success: true as const, data: result.data }
}
