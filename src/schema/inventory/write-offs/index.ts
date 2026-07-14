import { z } from 'zod'

export const WriteOffReasonCodeSchema = z.enum(['damaged', 'expired', 'write_off'])

export const REASON_CODE_LABELS: Record<WriteOffReasonCode, string> = {
  damaged: 'Damaged',
  expired: 'Expired',
  write_off: 'Write-off',
}

export const CreateWriteOffFormSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unitCost: z.number().min(0, 'Unit cost must be 0 or greater'),
  reasonCode: WriteOffReasonCodeSchema,
  notes: z.string().min(1, 'Supporting note is required').max(1000),
  variantId: z.string().optional(),
  batchId: z.string().optional(),
  locationId: z.string().optional(),
  writeOffDate: z.string().optional(),
})

export type CreateWriteOffFormValues = z.infer<typeof CreateWriteOffFormSchema>
export type WriteOffReasonCode = z.infer<typeof WriteOffReasonCodeSchema>

export const WriteOffStatusSchema = z.enum(['pending', 'approved', 'rejected'])
export type WriteOffStatus = z.infer<typeof WriteOffStatusSchema>

export const RejectWriteOffFormSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
})
export type RejectWriteOffFormValues = z.infer<typeof RejectWriteOffFormSchema>

const WriteOffItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
})

const WriteOffWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
})

const WriteOffBranchSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().nullable().optional(),
})

const WriteOffAccountingEntrySchema = z.object({
  id: z.string(),
  referenceNumber: z.string().optional(),
  amount: z.number().optional(),
  accountName: z.string().optional(),
})

export const WriteOffSummarySchema = z.object({
  id: z.string(),
  adjustmentNumber: z.string().optional(),
  item: WriteOffItemSchema.optional(),
  warehouse: WriteOffWarehouseSchema.optional(),
  branch: WriteOffBranchSchema.nullable().optional(),
  quantity: z.number().optional().nullable(),
  unitCost: z.number().optional().nullable(),
  reasonCode: WriteOffReasonCodeSchema,
  notes: z.string().optional().nullable(),
  accountingEntry: WriteOffAccountingEntrySchema.optional().nullable(),
  writeOffDate: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  createdBy: z.object({ id: z.string(), name: z.string() }).optional().nullable(),
  writeOffStatus: WriteOffStatusSchema.nullable().optional(),
  approvedById: z.string().nullable().optional(),
  approvedAt: z.string().nullable().optional(),
  rejectedById: z.string().nullable().optional(),
  rejectedAt: z.string().nullable().optional(),
  rejectedReason: z.string().nullable().optional(),
})

export const WriteOffListResponseSchema = z.object({
  data: z.array(WriteOffSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type WriteOffSummary = z.infer<typeof WriteOffSummarySchema>
export type WriteOffListResponse = z.infer<typeof WriteOffListResponseSchema>
