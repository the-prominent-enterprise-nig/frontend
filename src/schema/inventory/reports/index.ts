import { z } from 'zod'

// ── Pagination ─────────────────────────────────────────────────────────────────
export const ReportPaginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  lastPage: z.number(),
})
export type ReportPaginationMeta = z.infer<typeof ReportPaginationMetaSchema>

// ── Valuation Report ──────────────────────────────────────────────────────────
export const ValuationReportItemSchema = z.object({
  itemId: z.string(),
  itemName: z.string(),
  sku: z.string(),
  category: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  warehouseName: z.string().optional().nullable(),
  onHandQty: z.number().default(0),
  costPrice: z.number().default(0),
  totalValue: z.number().default(0),
  costingMethod: z.string().optional().nullable(),
})

export const ValuationCategoryBreakdownSchema = z.object({
  category: z.string(),
  totalValue: z.number(),
  totalQty: z.number(),
  itemCount: z.number(),
})

export const ValuationWarehouseBreakdownSchema = z.object({
  warehouseId: z.string(),
  warehouseName: z.string(),
  totalValue: z.number(),
  totalQty: z.number(),
  itemCount: z.number(),
})

export const ValuationReportResponseSchema = z.object({
  data: z.array(ValuationReportItemSchema),
  summary: z.object({
    totalItems: z.number(),
    totalQty: z.number(),
    totalValue: z.number(),
    byCategory: z.array(ValuationCategoryBreakdownSchema).optional(),
    byWarehouse: z.array(ValuationWarehouseBreakdownSchema).optional(),
  }),
  meta: ReportPaginationMetaSchema.optional(),
  generatedAt: z.string().optional(),
})

export type ValuationReportItem = z.infer<typeof ValuationReportItemSchema>
export type ValuationReportResponse = z.infer<typeof ValuationReportResponseSchema>

// ── Turnover & Aging Report ───────────────────────────────────────────────────
export const AgingBucket = z.enum(['0-30', '31-60', '61-90', '90+'])
export type AgingBucket = z.infer<typeof AgingBucket>

export const TurnoverReportItemSchema = z.object({
  itemId: z.string(),
  itemName: z.string(),
  sku: z.string(),
  category: z.string().optional().nullable(),
  onHandQty: z.number().default(0),
  qtySold: z.number().default(0),
  salesVelocityPerDay: z.number().default(0),
  daysOfStock: z.number().optional().nullable(),
  lastSaleDate: z.string().optional().nullable(),
  agingBucket: AgingBucket.optional().nullable(),
  totalValue: z.number().default(0),
  status: z.enum(['healthy', 'slow_moving', 'dead_stock']).default('healthy'),
})

export const TurnoverReportResponseSchema = z.object({
  data: z.array(TurnoverReportItemSchema),
  summary: z.object({
    totalItems: z.number(),
    slowMoving: z.number(),
    deadStock: z.number(),
    agingBreakdown: z.object({
      '0-30': z.number(),
      '31-60': z.number(),
      '61-90': z.number(),
      '90+': z.number(),
    }),
  }),
  meta: ReportPaginationMetaSchema.optional(),
  periodDays: z.number().optional(),
  generatedAt: z.string().optional(),
})

export type TurnoverReportItem = z.infer<typeof TurnoverReportItemSchema>
export type TurnoverReportResponse = z.infer<typeof TurnoverReportResponseSchema>

// ── Aging Report (real lastMovementAt-based aging, distinct from Turnover's
// projected days-of-supply) ─────────────────────────────────────────────────
export const AgingEntrySchema = z.object({
  itemId: z.string(),
  sku: z.string(),
  name: z.string(),
  warehouseId: z.string(),
  warehouseName: z.string(),
  onHandQty: z.number(),
  daysSinceLastMovement: z.number(),
  estimatedValue: z.number(),
})

const AgingBucketSummarySchema = z.object({
  count: z.number(),
  totalValue: z.number(),
})

export const AgingReportResponseSchema = z.object({
  buckets: z.object({
    '0_30': z.array(AgingEntrySchema),
    '31_60': z.array(AgingEntrySchema),
    '61_90': z.array(AgingEntrySchema),
    '90_plus': z.array(AgingEntrySchema),
  }),
  summary: z.object({
    '0_30': AgingBucketSummarySchema,
    '31_60': AgingBucketSummarySchema,
    '61_90': AgingBucketSummarySchema,
    '90_plus': AgingBucketSummarySchema,
  }),
})

export type AgingEntry = z.infer<typeof AgingEntrySchema>
export type AgingReportResponse = z.infer<typeof AgingReportResponseSchema>
