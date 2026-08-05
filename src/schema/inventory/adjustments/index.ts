import { z } from 'zod'
import { AdjustmentReasonCodeSchema } from '@/src/schema/inventory/stock-counts'
import { BatchStatusSchema } from '@/src/schema/inventory/batches'
import { SerialStatusSchema } from '@/src/schema/inventory/serial-numbers'

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

const AdjustmentWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
})

const AdjustmentLineItemSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
})

const AdjustmentLineBatchSchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  status: BatchStatusSchema,
})

const AdjustmentLineSerialSchema = z.object({
  id: z.string(),
  serialNumber: z.string(),
  status: SerialStatusSchema,
})

export const AdjustmentLineSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  item: AdjustmentLineItemSchema,
  variantId: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),
  batch: AdjustmentLineBatchSchema.optional().nullable(),
  locationId: z.string().optional().nullable(),
  serialNumberId: z.string().optional().nullable(),
  serialNumber: AdjustmentLineSerialSchema.optional().nullable(),
  expectedQty: z.coerce.number(),
  actualQty: z.coerce.number(),
  unitCost: z.coerce.number().optional().nullable(),
})
export type AdjustmentLine = z.infer<typeof AdjustmentLineSchema>

export const AdjustmentDetailSchema = z.object({
  id: z.string(),
  adjustmentNumber: z.string(),
  warehouse: AdjustmentWarehouseSchema.optional().nullable(),
  adjustmentDate: z.string(),
  reasonCode: AdjustmentReasonCodeSchema,
  notes: z.string().optional().nullable(),
  status: AdjustmentStatusSchema,
  totalImpactValue: z.coerce.number().optional().nullable(),
  journalEntryId: z.string().optional().nullable(),
  submittedById: z.string().optional().nullable(),
  confirmedAt: z.string().optional().nullable(),
  confirmedById: z.string().optional().nullable(),
  investigatingAt: z.string().optional().nullable(),
  investigatingById: z.string().optional().nullable(),
  approvedAt: z.string().optional().nullable(),
  approvedById: z.string().optional().nullable(),
  rejectedAt: z.string().optional().nullable(),
  rejectedById: z.string().optional().nullable(),
  rejectedReason: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  lines: z.array(AdjustmentLineSchema),
})
export type AdjustmentDetail = z.infer<typeof AdjustmentDetailSchema>

export const AdjustmentListResponseSchema = z.object({
  data: z.array(AdjustmentDetailSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})
export type AdjustmentListResponse = z.infer<typeof AdjustmentListResponseSchema>

export const RejectAdjustmentFormSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
})
export type RejectAdjustmentFormValues = z.infer<typeof RejectAdjustmentFormSchema>
