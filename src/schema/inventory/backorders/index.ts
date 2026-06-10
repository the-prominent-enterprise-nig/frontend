import { z } from 'zod'

export const BackorderStatusEnum = z.enum([
  'pending',
  'partially_fulfilled',
  'fulfilled',
  'cancelled',
])
export type BackorderStatus = z.infer<typeof BackorderStatusEnum>

export const BackorderFormSchema = z.object({
  salesOrderId: z.string().min(1, 'Sales order ID is required'),
  salesOrderLineId: z.string().min(1, 'Sales order line ID is required'),
  itemId: z.string().min(1, 'Item is required'),
  orderedQty: z.number().positive('Ordered quantity must be greater than 0'),
  backorderedQty: z.number().positive('Backordered quantity must be greater than 0'),
  commitmentDate: z.string().min(1, 'Commitment date is required'),
  expectedFulfillAt: z.string().optional(),
  notes: z.string().optional(),
})
export type BackorderFormValues = z.infer<typeof BackorderFormSchema>

export const BackorderUpdateFormSchema = z.object({
  expectedFulfillAt: z.string().optional(),
  status: BackorderStatusEnum.optional(),
})
export type BackorderUpdateFormValues = z.infer<typeof BackorderUpdateFormSchema>

const BackorderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
})

export const BackorderSchema = z.object({
  id: z.string(),
  salesOrderId: z.string(),
  salesOrderLineId: z.string(),
  itemId: z.string(),
  item: BackorderItemSchema.optional().nullable(),
  orderedQty: z.number(),
  backorderedQty: z.number(),
  commitmentDate: z.string(),
  expectedFulfillAt: z.string().optional().nullable(),
  status: BackorderStatusEnum,
  notes: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const BackorderListResponseSchema = z.object({
  data: z.array(BackorderSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type Backorder = z.infer<typeof BackorderSchema>
export type BackorderListResponse = z.infer<typeof BackorderListResponseSchema>
