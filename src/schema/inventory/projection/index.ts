import { z } from 'zod'

export const DailyProjectionEntrySchema = z.object({
  date: z.string(),
  incomingQty: z.number(),
  outgoingQty: z.number(),
  endBalance: z.number(),
})

export const ProjectionItemSchema = z.object({
  itemId: z.string(),
  sku: z.string(),
  name: z.string(),
  warehouseId: z.string(),
  warehouseName: z.string(),
  startQty: z.number(),
  activeReservations: z.number(),
  projectedMinBalance: z.number(),
  projectedStockout: z.boolean(),
  stockoutDate: z.string().optional(),
  atReorderLevel: z.boolean(),
  dailyProjections: z.array(DailyProjectionEntrySchema),
})

export const ProjectionListResponseSchema = z.object({
  projectionDays: z.number(),
  projectionDate: z.string(),
  stockoutCount: z.number(),
  reorderCount: z.number(),
  items: z.array(ProjectionItemSchema),
})

/**
 * `GET /inventory/projection?view=summary`: each item without its per-day
 * timeline (31+ entries per item, ~40 MB across a full catalog), carrying the
 * horizon totals the list shows instead. `total` is the full item count and is
 * only present on paged calls.
 */
export const ProjectionSummaryItemSchema = ProjectionItemSchema.omit({
  dailyProjections: true,
}).extend({
  incomingQty: z.number(),
  outgoingQty: z.number(),
})

export const ProjectionSummaryResponseSchema = ProjectionListResponseSchema.omit({
  items: true,
}).extend({
  items: z.array(ProjectionSummaryItemSchema),
  total: z.number().optional(),
})

export const StockoutAlertSchema = z.object({
  itemId: z.string(),
  sku: z.string(),
  name: z.string(),
  warehouseId: z.string(),
  warehouseName: z.string(),
  currentQty: z.number(),
  stockoutDate: z.string().optional(),
})

export const StockoutAlertListResponseSchema = z.object({
  data: z.array(StockoutAlertSchema),
  total: z.number().optional(),
})

export type ProjectionItem = z.infer<typeof ProjectionItemSchema>
export type ProjectionListResponse = z.infer<typeof ProjectionListResponseSchema>
export type ProjectionSummaryItem = z.infer<typeof ProjectionSummaryItemSchema>
export type ProjectionSummaryResponse = z.infer<typeof ProjectionSummaryResponseSchema>
export type StockoutAlert = z.infer<typeof StockoutAlertSchema>
export type StockoutAlertListResponse = z.infer<typeof StockoutAlertListResponseSchema>
