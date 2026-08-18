import { z } from 'zod'
import {
  CreatePoLineSchema,
  CreatePoFormSchema,
  LineDiscountSchema,
} from '@/src/schema/inventory/purchase-orders'

// A Purchase Request is created with the exact same commitment as a
// Purchase Order (firm supplier + priced/discounted lines) — the only
// difference is it's pending approval before it becomes one. Aliasing PO's
// schema/types directly (rather than redefining an identical shape) is what
// keeps the two forms from drifting apart again.
export const CreatePrLineSchema = CreatePoLineSchema
export const CreatePurchaseRequestFormSchema = CreatePoFormSchema

export const UpdatePurchaseRequestFormSchema = CreatePurchaseRequestFormSchema

export const ApprovePrFormSchema = z.object({
  remarks: z.string().max(500).optional(),
})

export const RejectPrFormSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason must be 500 characters or less'),
})

export const PrApprovalSchema = z.object({
  id: z.string(),
  tier: z.number(),
  label: z.string(),
  approverId: z.string().nullable(),
  status: z.enum(['pending', 'approved', 'rejected']),
  remarks: z.string().nullable(),
  actedAt: z.string().nullable(),
})

const PrItemSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
})

const PrSupplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  taxId: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
})

const PrWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
})

// Same input-field shape as PoLineSchema (unitPrice/description/srp/
// discounts/isFreebie) — PO-computed-only fields (discountedCost,
// lastPriceOverridden, lineTotal) aren't mirrored here, see the plan's
// "computed line fields" decision.
const PrLineSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  quantity: z.coerce.number(),
  item: PrItemSchema,
  unitPrice: z.coerce.number().optional().nullable(),
  description: z.string().optional().nullable(),
  srp: z.coerce.number().optional().nullable(),
  discounts: z.array(LineDiscountSchema).optional().nullable(),
  isFreebie: z.boolean().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const PurchaseRequestSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'cancelled', 'converted']),
  requestedById: z.string(),
  branchId: z.string().nullable(),
  branch: z
    .object({
      id: z.string(),
      name: z.string(),
      addressLine1: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
    })
    .nullable(),
  supplierId: z.string().nullable(),
  supplier: PrSupplierSchema.nullable(),
  warehouseId: z.string().nullable(),
  warehouse: PrWarehouseSchema.nullable(),
  expectedDeliveryDate: z.string().nullable(),
  deliveryInstructions: z.string().nullable(),
  paymentTerms: z.string().nullable(),
  shippingAddress: z.string().nullable(),
  reason: z.string().nullable(),
  notes: z.string().nullable(),
  submittedAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
  approvals: z.array(PrApprovalSchema),
  lines: z.array(PrLineSchema),
  convertedToPo: z
    .object({
      id: z.string(),
      code: z.string(),
      status: z.string(),
    })
    .nullable(),
  createdAt: z.string(),
})

export const PurchaseRequestListResponseSchema = z.object({
  data: z.array(PurchaseRequestSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type CreatePrLineValues = z.infer<typeof CreatePrLineSchema>
export type CreatePurchaseRequestFormValues = z.infer<typeof CreatePurchaseRequestFormSchema>
export type UpdatePurchaseRequestFormValues = z.infer<typeof UpdatePurchaseRequestFormSchema>
export type ApprovePrFormValues = z.infer<typeof ApprovePrFormSchema>
export type RejectPrFormValues = z.infer<typeof RejectPrFormSchema>
export type PrApproval = z.infer<typeof PrApprovalSchema>
export type PurchaseRequestSummary = z.infer<typeof PurchaseRequestSummarySchema>
export type PurchaseRequestListResponse = z.infer<typeof PurchaseRequestListResponseSchema>
