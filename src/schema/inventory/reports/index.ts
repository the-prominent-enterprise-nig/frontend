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

export const ValuationReportResponseSchema = z.object({
  data: z.array(ValuationReportItemSchema),
  summary: z.object({
    totalItems: z.number(),
    totalQty: z.number(),
    totalValue: z.number(),
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
