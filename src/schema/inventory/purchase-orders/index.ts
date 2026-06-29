import { z } from 'zod'

export const ConvertPrToPoLineSchema = z.object({
  prLineId: z.string().min(1, 'PR line is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price must be 0 or greater'),
  notes: z.string().max(500).optional(),
})

export const ConvertPrToPoFormSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  warehouseId: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  paymentTerms: z.string().max(50).optional(),
  shippingAddress: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(ConvertPrToPoLineSchema).min(1, 'At least one line item is required'),
})

const PoSupplierSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const PoWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const PoItemSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
})

const PoLineSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  item: PoItemSchema,
  quantity: z.number(),
  unitPrice: z.coerce.number(),
  lineTotal: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const PurchaseOrderSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  status: z.enum([
    'draft',
    'sent',
    'acknowledged',
    'partially_received',
    'received',
    'closed',
    'cancelled',
  ]),
  supplierId: z.string(),
  supplier: PoSupplierSchema,
  branchId: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  warehouse: PoWarehouseSchema.optional().nullable(),
  expectedDeliveryDate: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  totalAmount: z.coerce.number(),
  fromPr: z
    .object({
      id: z.string(),
      code: z.string(),
    })
    .nullable(),
  lines: z.array(PoLineSchema),
  createdAt: z.string(),
})

export const PurchaseOrderListResponseSchema = z.object({
  data: z.array(PurchaseOrderSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type ConvertPrToPoLineValues = z.infer<typeof ConvertPrToPoLineSchema>
export type ConvertPrToPoFormValues = z.infer<typeof ConvertPrToPoFormSchema>
export type PurchaseOrderSummary = z.infer<typeof PurchaseOrderSummarySchema>
export type PurchaseOrderListResponse = z.infer<typeof PurchaseOrderListResponseSchema>
