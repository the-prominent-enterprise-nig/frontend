'use server'

import { api } from '@/src/libs/api/client'
import { z } from 'zod'

const BranchSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type Branch = z.infer<typeof BranchSchema>

export async function getBranches(): Promise<Branch[]> {
  const result = await api.get<{ data: Branch[] } | Branch[]>('/branches', { limit: '200' })
  if (!result.success || !result.data) return []
  const raw = Array.isArray(result.data) ? result.data : result.data.data
  return raw.flatMap((b) => {
    const parsed = BranchSchema.safeParse(b)
    return parsed.success ? [parsed.data] : []
  })
}
