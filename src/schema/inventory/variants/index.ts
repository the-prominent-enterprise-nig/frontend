import { z } from 'zod'

// One attribute row in the form (converted to Record<string,string> before submission)
export const AttributeRowSchema = z.object({
  key: z.string().min(1, 'Attribute name is required'),
  value: z.string().min(1, 'Attribute value is required'),
})

export const CreateVariantFormSchema = z.object({
  variantSku: z
    .string()
    .min(1, 'Variant SKU is required')
    .max(80)
    .regex(/^[A-Za-z0-9\-_]+$/, 'SKU may only contain letters, numbers, hyphens, and underscores'),
  attributes: z.array(AttributeRowSchema).min(1, 'At least one attribute is required'),
  priceOverride: z.number().min(0).optional(),
})

export type CreateVariantFormValues = z.infer<typeof CreateVariantFormSchema>
export type AttributeRow = z.infer<typeof AttributeRowSchema>

export const UpdateVariantFormSchema = z.object({
  variantSku: z
    .string()
    .min(1, 'Variant SKU is required')
    .max(80)
    .regex(/^[A-Za-z0-9\-_]+$/, 'SKU may only contain letters, numbers, hyphens, and underscores')
    .optional(),
  attributes: z.array(AttributeRowSchema).optional(),
  priceOverride: z.number().min(0).optional(),
})

export type UpdateVariantFormValues = z.infer<typeof UpdateVariantFormSchema>

// Shape returned by GET /inventory/items/{id}/variants
export const VariantSummarySchema = z.object({
  id: z.string(),
  variantSku: z.string(),
  attributes: z.record(z.string(), z.string()).optional().nullable(),
  priceOverride: z.coerce.number().optional().nullable(),
  stockBalance: z.coerce.number().optional().nullable(),
  availableQty: z.coerce.number().optional().nullable(),
  onHandQty: z.coerce.number().optional().nullable(),
  createdAt: z.string().optional(),
})

export const VariantListResponseSchema = z.object({
  data: z.array(VariantSummarySchema),
  total: z.number().optional(),
})

export type VariantSummary = z.infer<typeof VariantSummarySchema>
export type VariantListResponse = z.infer<typeof VariantListResponseSchema>
