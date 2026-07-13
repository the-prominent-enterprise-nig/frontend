'use server'

import { api } from '@/src/libs/api/client'

export async function getReceivingDocument(id: string) {
  return api.get<unknown>(`/inventory/stock/receiving-reports/${id}/document`)
}
