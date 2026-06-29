import { z } from 'zod'

const ReceiveStockLineSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  purchaseOrderLineId: z.string().optional(),
  quantityReceived: z.number().positive('Quantity must be greater than 0'),
  unitCost: z.number().min(0).optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  qualityHold: z.boolean().optional(),
  notes: z.string().optional(),
})

export const ReceiveStockFormSchema = z.object({
  code: z.string().min(1, 'Reference number is required'),
  purchaseOrderNumber: z.string().optional(),
  purchaseOrderDate: z.string().optional(),
  warehouseId: z.string().min(1, 'Destination warehouse is required'),
  applicationType: z.enum(['new_stock', 'revert']),
  modeOfTransfer: z.string().optional(),
  nndpCost: z.number().positive().optional(),
  receivedAt: z.string().optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(ReceiveStockLineSchema).min(1, 'At least one item line is required'),
})

export type ReceiveStockFormValues = z.infer<typeof ReceiveStockFormSchema>

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

export const StockLedgerEntrySchema = z.object({
  id: z.string(),
  item: StockBalanceItemSchema.optional().nullable(),
  warehouse: StockBalanceWarehouseSchema.optional().nullable(),
  movementType: z.string(),
  quantity: z.number(),
  unitCost: z.number().optional().nullable(),
  referenceType: z.string().optional().nullable(),
  referenceId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  createdBy: z.object({ id: z.string(), name: z.string() }).optional().nullable(),
})

export const StockLedgerListResponseSchema = z.object({
  data: z.array(StockLedgerEntrySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type StockLedgerEntry = z.infer<typeof StockLedgerEntrySchema>
export type StockLedgerListResponse = z.infer<typeof StockLedgerListResponseSchema>
