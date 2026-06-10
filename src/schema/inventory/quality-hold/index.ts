import { z } from 'zod'

export const BatchStatusSchema = z.enum(['active', 'quarantine', 'expired', 'recalled'])
export const QualityHoldActionSchema = z.enum(['release', 'partial_release', 'reject'])

export const PlaceOnHoldFormSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  batchNumber: z.string().min(1, 'Batch number is required').max(100),
  receivedViaGrId: z.string().optional(),
  manufactureDate: z.string().optional(),
  expiryDate: z.string().optional(),
  reason: z.string().min(1, 'Reason for hold is required').max(500),
})

export const ReleaseHoldFormSchema = z
  .object({
    action: QualityHoldActionSchema,
    reason: z.string().min(1, 'Reason is required').max(500),
    releasedQuantity: z.number().positive('Released quantity must be positive').optional(),
    destinationWarehouseId: z.string().optional(),
    supplierRef: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.action === 'partial_release' && !val.releasedQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Released quantity is required for partial release',
        path: ['releasedQuantity'],
      })
    }
  })

export type PlaceOnHoldFormValues = z.infer<typeof PlaceOnHoldFormSchema>
export type ReleaseHoldFormValues = z.infer<typeof ReleaseHoldFormSchema>
export type BatchStatus = z.infer<typeof BatchStatusSchema>
export type QualityHoldAction = z.infer<typeof QualityHoldActionSchema>

const BatchItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
})

const BatchWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string().optional(),
})

export const BatchSummarySchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  status: BatchStatusSchema,
  item: BatchItemSchema.optional().nullable(),
  warehouse: BatchWarehouseSchema.optional().nullable(),
  manufactureDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  receivedViaGrId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  createdBy: z.object({ id: z.string(), name: z.string() }).optional().nullable(),
})

export const BatchListResponseSchema = z.object({
  data: z.array(BatchSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type BatchSummary = z.infer<typeof BatchSummarySchema>
export type BatchListResponse = z.infer<typeof BatchListResponseSchema>
