'use server'

import { api } from '@/src/libs/api/client'

export type OrgRelations = {
  departments: Array<{ id: string; name: string }>
  positions: Array<{ id: string; name: string }>
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
  const [departments, positions, branches] = await Promise.all([
    api.get('/human-resource/departments', { limit: 200 }),
    api.get('/human-resource/positions', { limit: 200 }),
    api.get('/branches', { limit: 200 }),
  ])

  return {
    departments: extractList(departments),
    positions: extractList(positions),
    branches: extractList(branches),
  }
}
