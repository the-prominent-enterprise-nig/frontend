import { z } from 'zod'

export const BsrStatusSchema = z.enum([
  'draft',
  'submitted',
  'approved',
  'rejected',
  'cancelled',
  'fulfilled',
])

export const CreateBsrLineSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  requestedQty: z.number().positive('Quantity must be positive'),
  notes: z.string().max(255).optional(),
})

export const CreateBsrFormSchema = z.object({
  branchId: z.string().min(1, 'Branch is required'),
  fromWarehouseId: z.string().min(1, 'Warehouse is required'),
  notes: z.string().max(500).optional(),
  lines: z.array(CreateBsrLineSchema).min(1, 'At least one item line is required'),
})

export const ApproveBsrFormSchema = z.object({
  reservationDays: z.number().min(1).max(90).optional(),
})

export const RejectBsrFormSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
})

export const BsrFilterSchema = z.object({
  status: BsrStatusSchema.optional(),
  branchId: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
})

export const BsrLineSummarySchema = z.object({
  id: z.string(),
  itemId: z.string(),
  item: z.object({ id: z.string(), name: z.string(), sku: z.string() }).optional(),
  requestedQty: z.number(),
  notes: z.string().nullable().optional(),
  reservationId: z.string().nullable().optional(),
})

export const BsrSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  status: BsrStatusSchema,
  branchId: z.string(),
  branch: z.object({ id: z.string(), name: z.string() }).optional(),
  fromWarehouseId: z.string(),
  fromWarehouse: z.object({ id: z.string(), name: z.string() }).optional(),
  notes: z.string().nullable().optional(),
  submittedAt: z.string().nullable().optional(),
  approvedAt: z.string().nullable().optional(),
  rejectedAt: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  fulfilledAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  lines: z.array(BsrLineSummarySchema).optional(),
  _count: z.object({ lines: z.number() }).optional(),
})

export const BsrListResponseSchema = z.object({
  data: z.array(BsrSummarySchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
  }),
})

export type BsrStatus = z.infer<typeof BsrStatusSchema>
export type BsrSummary = z.infer<typeof BsrSummarySchema>
export type BsrListResponse = z.infer<typeof BsrListResponseSchema>
export type CreateBsrFormValues = z.infer<typeof CreateBsrFormSchema>
export type CreateBsrLineValues = z.infer<typeof CreateBsrLineSchema>
export type ApproveBsrFormValues = z.infer<typeof ApproveBsrFormSchema>
export type RejectBsrFormValues = z.infer<typeof RejectBsrFormSchema>
export type BsrFilter = z.infer<typeof BsrFilterSchema>
