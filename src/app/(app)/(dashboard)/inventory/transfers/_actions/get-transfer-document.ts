'use server'

import { api } from '@/src/libs/api/client'

export async function getTransferDocument(id: string) {
  return api.get<unknown>(`/inventory/transfers/${id}/document`)
}
