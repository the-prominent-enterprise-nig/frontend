'use server'

import { api } from '@/src/libs/api/client'
import type { CountLine } from '@/src/schema/inventory/stock-counts'

export async function getCountLines(id: string) {
  return api.get<CountLine[]>(`/inventory/counts/${id}/lines`)
}
