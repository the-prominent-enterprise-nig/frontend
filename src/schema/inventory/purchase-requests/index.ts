import { z } from 'zod'

export const CreatePrLineSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  suggestedSupplierId: z.string().optional(),
  notes: z.string().max(500).optional(),
})

export const CreatePurchaseRequestFormSchema = z.object({
  branchId: z.string().optional(),
  reason: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(CreatePrLineSchema).min(1, 'At least one line item is required'),
})

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

const PrLineSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  quantity: z.number(),
  item: PrItemSchema,
  suggestedSupplierId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const PurchaseRequestSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'cancelled', 'converted']),
  requestedById: z.string(),
  branchId: z.string().nullable(),
  branch: z.object({ id: z.string(), name: z.string() }).nullable(),
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
export type ApprovePrFormValues = z.infer<typeof ApprovePrFormSchema>
export type RejectPrFormValues = z.infer<typeof RejectPrFormSchema>
export type PrApproval = z.infer<typeof PrApprovalSchema>
export type PurchaseRequestSummary = z.infer<typeof PurchaseRequestSummarySchema>
export type PurchaseRequestListResponse = z.infer<typeof PurchaseRequestListResponseSchema>
