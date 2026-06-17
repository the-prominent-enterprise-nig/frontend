'use server'

import { api } from '@/src/libs/api/client'

export type OrgRelations = {
  branches: Array<{ id: string; name: string }>
}

function extractList(
  result: Awaited<ReturnType<typeof api.get>>
): Array<{ id: string; name: string }> {
  if (!result.success) return []
  const data = result.data as
    | { data?: Array<{ id: string; name: string }> }
    | Array<{ id: string; name: string }>
    | null
  if (Array.isArray(data)) return data
  return data?.data ?? []
}

export async function fetchOrgRelations(): Promise<OrgRelations> {
  const branches = await api.get('/branches', { limit: 200 })
  return { branches: extractList(branches) }
}
