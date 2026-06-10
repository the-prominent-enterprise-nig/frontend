import { z } from 'zod'

export const ReturnConditionSchema = z.enum(['sellable', 'damaged'])

export const CreateReturnFormSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  condition: ReturnConditionSchema,
  originalSaleId: z.string().optional(),
  notes: z.string().max(1000).optional(),
  variantId: z.string().optional(),
  batchId: z.string().optional(),
  locationId: z.string().optional(),
})

export type CreateReturnFormValues = z.infer<typeof CreateReturnFormSchema>
export type ReturnCondition = z.infer<typeof ReturnConditionSchema>

const ReturnItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
})

const ReturnWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().optional(),
})

export const ReturnSummarySchema = z.object({
  id: z.string(),
  transactionType: z.string().optional(),
  quantity: z.coerce.number(),
  condition: ReturnConditionSchema.optional().nullable(),
  originalSaleId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  item: ReturnItemSchema.optional().nullable(),
  warehouse: ReturnWarehouseSchema.optional().nullable(),
  occurredAt: z.string().optional(),
  createdAt: z.string().optional(),
  createdBy: z.object({ id: z.string(), name: z.string() }).optional().nullable(),
})

export const ReturnListResponseSchema = z.object({
  data: z.array(ReturnSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type ReturnSummary = z.infer<typeof ReturnSummarySchema>
export type ReturnListResponse = z.infer<typeof ReturnListResponseSchema>
