'use server'

import { api } from '@/src/libs/api/client'

export async function getChangeHistory(itemId: string, page = 1, limit = 20) {
  return api.get(`/inventory/items/${itemId}/change-history?page=${page}&limit=${limit}`)
}
