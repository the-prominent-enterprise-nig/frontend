import { z } from 'zod'

export const ReorderRuleFormSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().optional(),
  reorderPoint: z.number().min(0, 'Reorder point must be 0 or greater'),
  reorderQuantity: z.number().positive('Reorder quantity must be greater than 0'),
  preferredSupplierId: z.string().optional(),
  autoCreatePr: z.boolean(),
})
export type ReorderRuleFormValues = z.infer<typeof ReorderRuleFormSchema>

const ReorderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
})

const ReorderWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
})

export const ReorderRuleSchema = z.object({
  id: z.string(),
  item: ReorderItemSchema.optional().nullable(),
  warehouse: ReorderWarehouseSchema.optional().nullable(),
  reorderPoint: z.number(),
  reorderQuantity: z.number(),
  preferredSupplierId: z.string().optional().nullable(),
  autoCreatePr: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  minStockLevel: z.number().optional().nullable(),
  maxStockLevel: z.number().optional().nullable(),
  safetyStock: z.number().optional().nullable(),
})

export const ReorderRuleListResponseSchema = z.object({
  data: z.array(ReorderRuleSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type ReorderRule = z.infer<typeof ReorderRuleSchema>
export type ReorderRuleListResponse = z.infer<typeof ReorderRuleListResponseSchema>

export const ReorderAlertSchema = z.object({
  itemId: z.string(),
  item: ReorderItemSchema.optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  warehouse: ReorderWarehouseSchema.optional().nullable(),
  currentQty: z.number(),
  reorderPoint: z.number(),
  reorderQuantity: z.number(),
  hasActivePr: z.boolean().optional(),
})

export const ReorderAlertListResponseSchema = z.object({
  data: z.array(ReorderAlertSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type ReorderAlert = z.infer<typeof ReorderAlertSchema>
export type ReorderAlertListResponse = z.infer<typeof ReorderAlertListResponseSchema>

export const StockLevelFormSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().nullable().optional(),
  reorderPoint: z.coerce.number().min(0).default(0),
  reorderQuantity: z.coerce.number().min(0).default(0),
  minStockLevel: z.coerce.number().min(0, 'Min must be 0 or greater').optional(),
  maxStockLevel: z.coerce.number().min(0, 'Max must be 0 or greater').optional(),
  safetyStock: z.coerce.number().min(0).optional(),
  autoCreatePr: z.boolean().default(false),
})
export type StockLevelFormValues = z.infer<typeof StockLevelFormSchema>
