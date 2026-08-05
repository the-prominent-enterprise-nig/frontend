import { z } from 'zod'

export const PriceUseTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type PriceUseType = z.infer<typeof PriceUseTypeSchema>

export const PriceUseTypeFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150),
  description: z.string().max(500).optional(),
})
export type PriceUseTypeFormValues = z.infer<typeof PriceUseTypeFormSchema>
