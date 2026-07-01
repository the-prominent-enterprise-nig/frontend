import { z } from 'zod'

export const ConvertPrToPoLineSchema = z.object({
  prLineId: z.string().min(1, 'PR line is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price must be 0 or greater'),
  description: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
})

export const ConvertPrToPoFormSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  warehouseId: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  deliveryInstructions: z.string().max(1000).optional(),
  paymentTerms: z.string().max(50).optional(),
  shippingAddress: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(ConvertPrToPoLineSchema).min(1, 'At least one line item is required'),
})

const ConvertPrToPoLineServerSchema = ConvertPrToPoLineSchema.extend({
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be 0 or greater'),
})

export const ConvertPrToPoServerSchema = ConvertPrToPoFormSchema.extend({
  lines: z.array(ConvertPrToPoLineServerSchema).min(1, 'At least one line item is required'),
})

const PoSupplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  taxId: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
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
  description: z.string().optional().nullable(),
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
    'approved',
    'sent',
    'partially_received',
    'fully_received',
    'closed',
    'cancelled',
  ]),
  supplierId: z.string(),
  supplier: PoSupplierSchema,
  branchId: z.string().optional().nullable(),
  warehouseId: z.string().optional().nullable(),
  warehouse: PoWarehouseSchema.optional().nullable(),
  orderDate: z.string().optional().nullable(),
  expectedDeliveryDate: z.string().optional().nullable(),
  deliveryInstructions: z.string().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  shippingAddress: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  subtotalAmount: z.coerce.number().optional().nullable(),
  totalAmount: z.coerce.number(),
  preparedById: z.string().optional().nullable(),
  approvedById: z.string().optional().nullable(),
  approvedAt: z.string().optional().nullable(),
  sentAt: z.string().optional().nullable(),
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
