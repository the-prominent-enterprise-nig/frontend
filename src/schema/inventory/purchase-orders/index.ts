import { z } from 'zod'

// ─── Create PO (direct, no PR) ────────────────────────────────────────────────

export const POLineDiscountTypeSchema = z.enum(['percentage', 'amount'])

// Scenario 10 Part 6 (revised) — one step in a line's discount chain,
// applied sequentially off srp: each step's output feeds the next (e.g.
// 30% then 20% off, not 30+20=50% off in one step).
export const LineDiscountSchema = z.object({
  type: POLineDiscountTypeSchema,
  value: z.number().min(0),
})

export const CreatePoLineSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price must be 0 or greater'),
  description: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
  // Scenario 10 Part 6 — supplier SRP + an ordered chain of discounts off
  // it. The form normalizes an empty number input to undefined via
  // `setValueAs` before this ever validates (see CreatePoModal.tsx) —
  // react-hook-form's `valueAsNumber` alone would leave an empty field as
  // NaN, which z.number().optional() still rejects.
  srp: z.number().min(0).optional(),
  discounts: z.array(LineDiscountSchema).optional(),
  // Scenario 10 Part 8 — a supplier-given free unit; price is forced to 0.
  isFreebie: z.boolean().optional(),
})

export const CreatePoFormSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  branchId: z.string().optional(),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  expectedDeliveryDate: z.string().optional(),
  deliveryInstructions: z.string().max(1000).optional(),
  paymentTerms: z.string().max(50).optional(),
  shippingAddress: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(CreatePoLineSchema).min(1, 'At least one line item is required'),
})

const CreatePoLineServerSchema = CreatePoLineSchema.extend({
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be 0 or greater'),
  srp: z.coerce.number().min(0).optional(),
})

export const CreatePoServerSchema = CreatePoFormSchema.extend({
  lines: z.array(CreatePoLineServerSchema).min(1, 'At least one line item is required'),
})

// ─── Update PO (draft fields only) ───────────────────────────────────────────

export const UpdatePoFormSchema = z.object({
  warehouseId: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  deliveryInstructions: z.string().max(1000).optional(),
  paymentTerms: z.string().max(50).optional(),
  shippingAddress: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
})

// ─── Cancel PO ────────────────────────────────────────────────────────────────

export const CancelPoSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
})

// ─── Convert PR → PO ─────────────────────────────────────────────────────────

export const ConvertPrToPoLineSchema = z.object({
  prLineId: z.string().min(1, 'PR line is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitPrice: z.number().min(0, 'Unit price must be 0 or greater'),
  description: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
})

export const ConvertPrToPoFormSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
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
  address: z.string().optional().nullable(),
})

const PoItemSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  isSerialTracked: z.boolean().optional(),
})

const PoLineSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  item: PoItemSchema,
  description: z.string().optional().nullable(),
  quantity: z.coerce.number(),
  // Nullable — Scenario 05 followup, stripped server-side for a caller
  // without inventory:cost:view (subtotalAmount/totalAmount at the PO
  // level stay intact regardless).
  unitPrice: z.coerce.number().nullable(),
  receivedQuantity: z.coerce.number().optional().nullable(),
  lineTotal: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Scenario 10 Part 6 — supplier SRP + an ordered chain of discounts off
  // it, and the computed discounted cost / whether unitPrice was manually
  // overridden from it.
  srp: z.coerce.number().optional().nullable(),
  discounts: z.array(LineDiscountSchema).optional().nullable(),
  discountedCost: z.coerce.number().optional().nullable(),
  lastPriceOverridden: z.boolean().optional().nullable(),
  // Scenario 10 Part 8 — a supplier-given free unit.
  isFreebie: z.boolean().optional().nullable(),
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
  branch: PoWarehouseSchema.optional().nullable(),
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
  preparedByName: z.string().optional().nullable(),
  approvedById: z.string().optional().nullable(),
  approvedByName: z.string().optional().nullable(),
  approvedAt: z.string().optional().nullable(),
  sentAt: z.string().optional().nullable(),
  cancellationReason: z.string().optional().nullable(),
  cancelledById: z.string().optional().nullable(),
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

export type CreatePoLineValues = z.infer<typeof CreatePoLineSchema>
export type CreatePoFormValues = z.infer<typeof CreatePoFormSchema>
export type UpdatePoFormValues = z.infer<typeof UpdatePoFormSchema>
export type CancelPoValues = z.infer<typeof CancelPoSchema>
export type ConvertPrToPoLineValues = z.infer<typeof ConvertPrToPoLineSchema>
export type ConvertPrToPoFormValues = z.infer<typeof ConvertPrToPoFormSchema>
export type PurchaseOrderSummary = z.infer<typeof PurchaseOrderSummarySchema>
export type PurchaseOrderListResponse = z.infer<typeof PurchaseOrderListResponseSchema>
