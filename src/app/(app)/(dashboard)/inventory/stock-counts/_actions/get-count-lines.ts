'use server'

import { api } from '@/src/libs/api/client'
import type { CountLineSnapshot } from '@/src/schema/inventory/stock-counts'

export async function getCountLines(id: string) {
  return api.get<CountLineSnapshot[]>(`/inventory/counts/${id}/lines`)
}
