import { z } from 'zod'

export const ItemClassificationFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150, 'Name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
})
export type ItemClassificationFormValues = z.infer<typeof ItemClassificationFormSchema>

export const ItemClassificationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
export type ItemClassification = z.infer<typeof ItemClassificationSchema>

export const ItemClassificationListResponseSchema = z.array(ItemClassificationSchema)
export type ItemClassificationListResponse = z.infer<typeof ItemClassificationListResponseSchema>
