'use server'

import { api } from '@/src/libs/api/client'
import { z } from 'zod'

const CurrencySchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  rate: z.number(),
  mainCurrency: z.boolean().optional(),
  visibility: z.boolean().optional(),
})

export type Currency = z.infer<typeof CurrencySchema>

export async function getCurrencies() {
  const result = await api.get<Currency[]>('/currencies')
  if (!result.success) return []
  const raw = Array.isArray(result.data) ? result.data : []
  return raw.flatMap((c) => {
    const parsed = CurrencySchema.safeParse(c)
    return parsed.success ? [parsed.data] : []
  })
}
