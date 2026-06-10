import { z } from 'zod'

export const ItemSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
})

export const WarehouseSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
})

export const ProjectionItemSchema = z.object({
  itemId: z.string(),
  item: ItemSummarySchema.optional(),
  warehouseId: z.string().optional(),
  warehouse: WarehouseSummarySchema.optional(),
  currentOnHand: z.number(),
  incomingQty: z.number(),
  reservedQty: z.number(),
  projectedAvailable: z.number(),
  projectedStockoutDate: z.string().optional(),
  daysUntilStockout: z.number().optional(),
})

export const ProjectionListResponseSchema = z.object({
  data: z.array(ProjectionItemSchema),
  total: z.number().optional(),
})

export const StockoutAlertSchema = z.object({
  itemId: z.string(),
  item: ItemSummarySchema.optional(),
  warehouseId: z.string().optional(),
  warehouse: WarehouseSummarySchema.optional(),
  currentOnHand: z.number(),
  daysUntilStockout: z.number().optional(),
  projectedStockoutDate: z.string().optional(),
})

export const StockoutAlertListResponseSchema = z.object({
  data: z.array(StockoutAlertSchema),
  total: z.number().optional(),
})

export type ProjectionItem = z.infer<typeof ProjectionItemSchema>
export type ProjectionListResponse = z.infer<typeof ProjectionListResponseSchema>
export type StockoutAlert = z.infer<typeof StockoutAlertSchema>
export type StockoutAlertListResponse = z.infer<typeof StockoutAlertListResponseSchema>
