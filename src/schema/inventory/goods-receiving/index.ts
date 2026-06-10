import { z } from 'zod'

export const ReceiveStockFormSchema = z
  .object({
    itemId: z.string().min(1, 'Item is required'),
    warehouseId: z.string().min(1, 'Warehouse is required'),
    quantity: z.number().positive('Quantity must be greater than 0'),
    unitCost: z.number().min(0).optional(),
    locationId: z.string().optional(),
    variantId: z.string().optional(),
    batchId: z.string().optional(),
    expiryDate: z.string().optional(),
    referenceType: z.string().optional(),
    referenceId: z.string().optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine(
    (data) => {
      if (data.batchId && data.batchId.trim().length > 0) {
        return !!data.expiryDate && data.expiryDate.trim().length > 0
      }
      return true
    },
    { message: 'Expiry date is required when a batch ID is provided', path: ['expiryDate'] }
  )

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
