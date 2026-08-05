'use server'

import { api } from '@/src/libs/api/client'
import { PriceUseTypeSchema, type PriceUseType } from '@/src/schema/inventory/price-use-types'

export async function getPriceUseTypes(): Promise<PriceUseType[]> {
  const result = await api.get<unknown[]>('/inventory/price-use-types')
  if (!result.success || !result.data) return []
  return result.data.flatMap((t) => {
    const parsed = PriceUseTypeSchema.safeParse(t)
    return parsed.success ? [parsed.data] : []
  })
}
