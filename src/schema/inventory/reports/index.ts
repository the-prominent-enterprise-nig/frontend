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

// ── Aging Report (Scenario 29 INV-02) ───────────────────────────────────────
// Distinct from the Turnover report's own `AgingBucket` above (a coarser,
// sales-velocity-derived heuristic, 4 buckets, hyphenated values) — this is
// the dedicated per-serial aging report, aged from goods-receipt date,
// 5 buckets, underscore-separated values matching the backend's own enum.
export const SerialAgingBucketSchema = z.enum(['0_30', '31_60', '61_90', '91_180', '180_plus'])
export type SerialAgingBucket = z.infer<typeof SerialAgingBucketSchema>

export const SERIAL_AGING_BUCKET_LABELS: Record<SerialAgingBucket, string> = {
  '0_30': '0–30 days',
  '31_60': '31–60 days',
  '61_90': '61–90 days',
  '91_180': '91–180 days',
  '180_plus': '180+ days',
}

export const AgingReportItemSchema = z.object({
  serialNumberId: z.string(),
  serialNumber: z.string(),
  itemId: z.string(),
  sku: z.string(),
  name: z.string(),
  warehouseId: z.string().nullable(),
  warehouseName: z.string().nullable(),
  receivedAt: z.string(),
  daysSinceReceipt: z.number(),
  unitCost: z.number(),
  bucket: SerialAgingBucketSchema,
  slowMoving: z.boolean(),
  shouldBeOut: z.boolean(),
})

export const AgingReportResponseSchema = z.object({
  data: z.array(AgingReportItemSchema),
  summary: z.record(
    SerialAgingBucketSchema,
    z.object({ count: z.number(), totalValue: z.number() })
  ),
  meta: ReportPaginationMetaSchema.optional(),
  generatedAt: z.string().optional(),
})

export type AgingReportItem = z.infer<typeof AgingReportItemSchema>
export type AgingReportResponse = z.infer<typeof AgingReportResponseSchema>

// ── Stock Usage Reconciliation Report (Scenario 29 INV-03) ─────────────────────
// Two exception classes: StockLedger rows with no (or incomplete) source
// reference, and POS transactions/transfer dispatches/approved adjustments
// with no matching movement at all. Each capped server-side at 50 sample
// rows — meant to surface rare, real exceptions, not paginate a dataset.

export const NullReferenceLedgerRowSchema = z.object({
  stockLedgerId: z.string(),
  itemId: z.string(),
  sku: z.string(),
  itemName: z.string(),
  warehouseName: z.string(),
  transactionType: z.string(),
  quantityChange: z.number(),
  referenceType: z.string().nullable(),
  referenceId: z.string().nullable(),
  occurredAt: z.string(),
})

export const MissingPosMovementSchema = z.object({
  transactionId: z.string(),
  transactionNumber: z.string(),
  transactionType: z.string(),
  occurredAt: z.string(),
})

export const MissingTransferMovementSchema = z.object({
  transferId: z.string(),
  transferNumber: z.string(),
  status: z.string(),
  fromWarehouseName: z.string(),
  toWarehouseName: z.string(),
  transferDate: z.string(),
})

export const MissingAdjustmentMovementSchema = z.object({
  adjustmentId: z.string(),
  adjustmentNumber: z.string(),
  reasonCode: z.string(),
  warehouseName: z.string(),
  approvedAt: z.string().nullable(),
})

export const ReconciliationReportResponseSchema = z.object({
  dateRange: z.object({ startDate: z.string(), endDate: z.string() }),
  nullReference: z.object({ count: z.number(), sample: z.array(NullReferenceLedgerRowSchema) }),
  missingPosMovements: z.object({
    count: z.number(),
    sample: z.array(MissingPosMovementSchema),
  }),
  missingTransferMovements: z.object({
    count: z.number(),
    sample: z.array(MissingTransferMovementSchema),
  }),
  missingAdjustmentMovements: z.object({
    count: z.number(),
    sample: z.array(MissingAdjustmentMovementSchema),
  }),
  generatedAt: z.string().optional(),
})

export type NullReferenceLedgerRow = z.infer<typeof NullReferenceLedgerRowSchema>
export type MissingPosMovement = z.infer<typeof MissingPosMovementSchema>
export type MissingTransferMovement = z.infer<typeof MissingTransferMovementSchema>
export type MissingAdjustmentMovement = z.infer<typeof MissingAdjustmentMovementSchema>
export type ReconciliationReportResponse = z.infer<typeof ReconciliationReportResponseSchema>
