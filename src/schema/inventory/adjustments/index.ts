import { z } from 'zod'

// Scenario 19 Part 2 — approval chain status. submitted/confirmed/investigating
// carry zero stock/GL side effects; those only happen on the transition to
// approved.
export const AdjustmentStatusSchema = z.enum([
  'submitted',
  'confirmed',
  'investigating',
  'approved',
  'rejected',
])
export type AdjustmentStatus = z.infer<typeof AdjustmentStatusSchema>

export const ADJUSTMENT_STATUS_LABELS: Record<AdjustmentStatus, string> = {
  submitted: 'Submitted',
  confirmed: 'Confirmed',
  investigating: 'Investigating',
  approved: 'Approved',
  rejected: 'Rejected',
}

const AdjustmentItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
})

const AdjustmentLineSchema = z.object({
  id: z.string(),
  item: AdjustmentItemSchema.optional().nullable(),
  expectedQty: z.number(),
  actualQty: z.number(),
  unitCost: z.number().optional().nullable(),
  // Scenario 19 Part 3 — the actual system on-hand snapshot at posting time,
  // only present once the adjustment is approved (approve() is the only
  // place that writes StockLedger beforeQty/afterQty). Distinct from
  // expectedQty/actualQty, which are the submission-time inputs.
  beforeQty: z.number().optional().nullable(),
  afterQty: z.number().optional().nullable(),
})

const AdjustmentWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().optional(),
})

export const AdjustmentSummarySchema = z.object({
  id: z.string(),
  status: AdjustmentStatusSchema,
  item: AdjustmentItemSchema.optional().nullable(),
  warehouse: AdjustmentWarehouseSchema.optional().nullable(),
  quantity: z.number().optional().nullable(),
  unitCost: z.number().optional().nullable(),
  lines: z.array(AdjustmentLineSchema).default([]),
  reasonCode: z.string(),
  notes: z.string().optional().nullable(),
  writeOffDate: z.string(),
  accountingEntry: z.object({ id: z.string() }).optional().nullable(),
  confirmedById: z.string().optional().nullable(),
  confirmedByName: z.string().optional().nullable(),
  confirmedAt: z.string().optional().nullable(),
  investigatingById: z.string().optional().nullable(),
  investigatingByName: z.string().optional().nullable(),
  investigatingAt: z.string().optional().nullable(),
  decidedById: z.string().optional().nullable(),
  decidedByName: z.string().optional().nullable(),
  decidedAt: z.string().optional().nullable(),
  decisionReason: z.string().optional().nullable(),
  createdAt: z.string(),
})
export type AdjustmentSummary = z.infer<typeof AdjustmentSummarySchema>

export const AdjustmentListResponseSchema = z.object({
  data: z.array(AdjustmentSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})
export type AdjustmentListResponse = z.infer<typeof AdjustmentListResponseSchema>

export const RejectAdjustmentFormSchema = z.object({
  reason: z.string().min(1, 'A reason is required to reject an adjustment'),
})
export type RejectAdjustmentFormValues = z.infer<typeof RejectAdjustmentFormSchema>
