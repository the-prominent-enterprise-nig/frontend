import { z } from 'zod'

export const UDS_REASONS = ['repair', 'maintenance', 'quality_check', 'pull_out', 'loan'] as const
export const UDS_STATUSES = ['issued', 'in_transit', 'received', 'completed', 'cancelled'] as const

export const UdsReasonSchema = z.enum(UDS_REASONS)
export const UdsStatusSchema = z.enum(UDS_STATUSES)

export type UdsReason = z.infer<typeof UdsReasonSchema>
export type UdsStatus = z.infer<typeof UdsStatusSchema>

// ─── Create UDS ───────────────────────────────────────────────────────────────

const UdsLineFormSchema = z.object({
  serialNumberId: z.string().min(1, 'Serial number is required'),
  issueReason: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
})

export const CreateUdsFormSchema = z.object({
  warehouseId: z.string().optional(),
  reason: UdsReasonSchema,
  expectedReturnDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  rfsFormFileId: z.string().optional(),
  repairProviderId: z.string().optional(),
  lines: z.array(UdsLineFormSchema).min(1, 'At least one unit is required'),
})

export type CreateUdsFormValues = z.infer<typeof CreateUdsFormSchema>

// ─── Update UDS Status ────────────────────────────────────────────────────────

export const UpdateUdsStatusFormSchema = z.object({
  status: UdsStatusSchema,
  notes: z.string().max(1000).optional(),
})

export type UpdateUdsStatusFormValues = z.infer<typeof UpdateUdsStatusFormSchema>

// ─── Response Shapes ─────────────────────────────────────────────────────────

const UdsSerialSchema = z.object({
  id: z.string(),
  serialNumber: z.string(),
  status: z.string(),
})

const UdsItemSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
})

const UdsLineSchema = z.object({
  id: z.string(),
  serialNumberId: z.string(),
  serialNumber: UdsSerialSchema,
  itemId: z.string(),
  item: UdsItemSchema,
  issueReason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.string(),
})

const UdsWarehouseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
})

const UdsRfsFormFileSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
})

const UdsRepairProviderSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
})

const UdsLinkedStockTransferSchema = z.object({
  id: z.string(),
  transferNumber: z.string(),
  status: z.string(),
})

export const UdsSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  code: z.string(),
  warehouseId: z.string().optional().nullable(),
  warehouse: UdsWarehouseSchema.optional().nullable(),
  reason: UdsReasonSchema,
  status: UdsStatusSchema,
  issuedById: z.string(),
  expectedReturnDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  rfsFormFileId: z.string().optional().nullable(),
  rfsFormFile: UdsRfsFormFileSchema.optional().nullable(),
  repairProviderId: z.string().optional().nullable(),
  repairProvider: UdsRepairProviderSchema.optional().nullable(),
  linkedStockTransferId: z.string().optional().nullable(),
  linkedStockTransfer: UdsLinkedStockTransferSchema.optional().nullable(),
  lines: z.array(UdsLineSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const UdsListResponseSchema = z.object({
  data: z.array(UdsSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
  }),
})

export type Uds = z.infer<typeof UdsSchema>
export type UdsListResponse = z.infer<typeof UdsListResponseSchema>

// ─── Display helpers ──────────────────────────────────────────────────────────

export const UDS_REASON_LABELS: Record<UdsReason, string> = {
  repair: 'Repair',
  maintenance: 'Maintenance',
  quality_check: 'Quality Check',
  pull_out: 'Pull-out',
  loan: 'Loan',
}

export const UDS_STATUS_LABELS: Record<UdsStatus, string> = {
  issued: 'Issued',
  in_transit: 'In Transit',
  received: 'Received',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const UDS_STATUS_STYLES: Record<UdsStatus, string> = {
  issued: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-yellow-100 text-yellow-700',
  received: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-zinc-100 text-zinc-500',
}

export const UDS_REASON_STYLES: Record<UdsReason, string> = {
  repair: 'bg-red-100 text-red-700',
  maintenance: 'bg-orange-100 text-orange-700',
  quality_check: 'bg-yellow-100 text-yellow-700',
  pull_out: 'bg-purple-100 text-purple-700',
  loan: 'bg-blue-100 text-blue-700',
}
