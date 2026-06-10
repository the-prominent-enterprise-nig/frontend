import { z } from 'zod'

export const BatchStatusSchema = z.enum(['active', 'quarantine', 'expired', 'recalled'])
export type BatchStatus = z.infer<typeof BatchStatusSchema>

export const BATCH_STATUS_LABELS: Record<BatchStatus, string> = {
  active: 'Active',
  quarantine: 'Quarantine',
  expired: 'Expired',
  recalled: 'Recalled',
}

export const BATCH_STATUS_COLORS: Record<BatchStatus, string> = {
  active: 'bg-green-100 text-green-700',
  quarantine: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-700',
  recalled: 'bg-orange-100 text-orange-700',
}

export const CreateBatchFormSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  manufactureDate: z.string().optional(),
  expiryDate: z.string().optional(),
  status: BatchStatusSchema,
})
export type CreateBatchFormValues = z.infer<typeof CreateBatchFormSchema>

export const UpdateBatchStatusFormSchema = z.object({
  status: BatchStatusSchema,
  reason: z.string().optional(),
})
export type UpdateBatchStatusFormValues = z.infer<typeof UpdateBatchStatusFormSchema>

const BatchItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
})

export const BatchSummarySchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  item: BatchItemSchema.optional().nullable(),
  status: BatchStatusSchema,
  manufactureDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  receivedViaGrId: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const BatchListResponseSchema = z.object({
  data: z.array(BatchSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type BatchSummary = z.infer<typeof BatchSummarySchema>
export type BatchListResponse = z.infer<typeof BatchListResponseSchema>

export function getExpiryStatus(
  expiryDate: string | null | undefined
): 'safe' | 'expiring_soon' | 'expired' {
  if (!expiryDate) return 'safe'
  const expiry = new Date(expiryDate)
  const now = new Date()
  const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysUntilExpiry < 0) return 'expired'
  if (daysUntilExpiry <= 30) return 'expiring_soon'
  return 'safe'
}

export const EXPIRY_STATUS_COLORS = {
  safe: 'bg-green-100 text-green-700',
  expiring_soon: 'bg-amber-100 text-amber-700',
  expired: 'bg-red-100 text-red-700',
}

export const EXPIRY_STATUS_LABELS = {
  safe: 'Safe',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
}
