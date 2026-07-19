import { z } from 'zod'

const ReceiveStockLineSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  purchaseOrderLineId: z.string().optional(),
  quantityReceived: z.number().positive('Quantity must be greater than 0'),
  unitCost: z.number().min(0).optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  qualityHold: z.boolean().optional(),
  autoGenerateSerials: z.boolean().optional(),
  notes: z.string().optional(),
})

export const ReceiveStockFormSchema = z
  .object({
    code: z.string().optional(),
    purchaseOrderNumber: z.string().optional(),
    purchaseOrderDate: z.string().optional(),
    supplierId: z.string().optional(),
    withholding: z.enum(['none', 'pct_1']).optional(),
    warehouseId: z.string().min(1, 'Destination warehouse is required'),
    applicationType: z.enum(['new_stock', 'revert']),
    modeOfTransfer: z.string().optional(),
    nndpCost: z.number().positive().optional(),
    receivedAt: z.string().optional(),
    notes: z.string().max(1000).optional(),
    lines: z.array(ReceiveStockLineSchema).min(1, 'At least one item line is required'),
  })
  .refine((data) => !!data.supplierId || data.lines.some((line) => !!line.purchaseOrderLineId), {
    message: 'Supplier is required when this receipt is not linked to a PO',
    path: ['supplierId'],
  })

export type ReceiveStockFormValues = z.infer<typeof ReceiveStockFormSchema>

// ─── Stock Balances ───────────────────────────────────────────────────────────

const StockBalanceItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
})

const StockBalanceWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
})

export const StockBalanceSchema = z.object({
  id: z.string(),
  item: StockBalanceItemSchema.optional().nullable(),
  warehouse: StockBalanceWarehouseSchema.optional().nullable(),
  onHandQty: z.number().default(0),
  availableQty: z.number().default(0),
  reservedQty: z.number().default(0),
  reorderPoint: z.number().optional().nullable(),
  unitCost: z.number().optional().nullable(),
  updatedAt: z.string().optional(),
})

export const StockBalanceListResponseSchema = z.object({
  data: z.array(StockBalanceSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type StockBalance = z.infer<typeof StockBalanceSchema>
export type StockBalanceListResponse = z.infer<typeof StockBalanceListResponseSchema>

// ─── Stock Ledger ─────────────────────────────────────────────────────────────

const BranchSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().optional().nullable(),
})

const LedgerWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  branchId: z.string().optional().nullable(),
  branch: BranchSchema.optional().nullable(),
})

export const StockLedgerEntrySchema = z.object({
  id: z.string(),
  transactionType: z.string(),
  quantity: z.number(),
  condition: z.string().optional().nullable(),
  originalSaleId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  item: StockBalanceItemSchema.optional().nullable(),
  warehouse: LedgerWarehouseSchema.optional().nullable(),
  occurredAt: z.string().optional(),
  createdAt: z.string().optional(),
})

export const StockLedgerListResponseSchema = z.object({
  data: z.array(StockLedgerEntrySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type StockLedgerEntry = z.infer<typeof StockLedgerEntrySchema>
export type StockLedgerListResponse = z.infer<typeof StockLedgerListResponseSchema>

// ─── Receiving Reports ────────────────────────────────────────────────────────

const DiscrepancySchema = z.object({
  purchaseOrderId: z.string(),
  qtyOrdered: z.number(),
  qtyReceived: z.number(),
  qtyVariance: z.number(),
  hasQtyDiscrepancy: z.boolean(),
  hasConditionIssue: z.boolean(),
})

const ReceivingReportLineSchema = z.object({
  id: z.string(),
  goodsReceiptId: z.string(),
  itemId: z.string(),
  item: StockBalanceItemSchema.optional().nullable(),
  purchaseOrderLineId: z.string().optional().nullable(),
  quantityReceived: z.number(),
  batchNumber: z.string().optional().nullable(),
  serialNumbers: z.array(z.string()).optional(),
  qualityHold: z.boolean(),
  notes: z.string().optional().nullable(),
  discrepancy: DiscrepancySchema.nullable(),
})

const ReceivingReportWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  branchId: z.string().optional().nullable(),
  branch: BranchSchema.optional().nullable(),
})

const ReceivingReportSupplierSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
})

export const ReceivingReportSchema = z.object({
  id: z.string(),
  code: z.string(),
  status: z.string(),
  applicationType: z.string(),
  modeOfTransfer: z.string().optional().nullable(),
  receivedAt: z.string(),
  notes: z.string().optional().nullable(),
  warehouse: ReceivingReportWarehouseSchema.optional().nullable(),
  supplier: ReceivingReportSupplierSchema.optional().nullable(),
  poDate: z.string().optional().nullable(),
  purchaseOrderNumber: z.string().optional().nullable(),
  journalEntryId: z.string().optional().nullable(),
  withholding: z.enum(['none', 'pct_1']).optional(),
  withheldAmount: z.number().optional().nullable(),
  lines: z.array(ReceivingReportLineSchema),
  hasAnyDiscrepancy: z.boolean(),
})

export const ReceivingReportListResponseSchema = z.object({
  data: z.array(ReceivingReportSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
  }),
})

export type ReceivingReport = z.infer<typeof ReceivingReportSchema>
export type ReceivingReportListResponse = z.infer<typeof ReceivingReportListResponseSchema>

// ─── Withholding Summary ──────────────────────────────────────────────────────

export const WithholdingSummaryRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  receivedAt: z.string(),
  withholding: z.enum(['none', 'pct_1']),
  withheldAmount: z.number().nullable(),
  supplier: ReceivingReportSupplierSchema.optional().nullable(),
})

export const WithholdingSummaryResponseSchema = z.object({
  data: z.array(WithholdingSummaryRowSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
    totalWithheld: z.number(),
  }),
})

export type WithholdingSummaryRow = z.infer<typeof WithholdingSummaryRowSchema>
export type WithholdingSummaryResponse = z.infer<typeof WithholdingSummaryResponseSchema>
