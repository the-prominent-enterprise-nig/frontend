'use server'

import { api } from '@/src/libs/api/client'
import type { CountListResponse } from '@/src/schema/inventory/stock-counts'

export async function getMobileCountSessions() {
  const query: Record<string, string | number | undefined> = {
    status: 'in_progress',
    limit: 50,
  }
  return api.get<CountListResponse>('/inventory/counts', query)
}
