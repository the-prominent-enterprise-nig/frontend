'use server'

import { api } from '@/src/libs/api/client'
import type { ItemSummary } from '@/src/schema/inventory/items'

export async function getItem(id: string) {
  return api.get<ItemSummary>(`/inventory/items/${id}`)
}
