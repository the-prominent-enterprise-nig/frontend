import { z } from 'zod'

export const CountTypeSchema = z.enum(['full', 'cycle', 'spot'])
export type CountType = z.infer<typeof CountTypeSchema>

export const COUNT_TYPE_LABELS: Record<CountType, string> = {
  full: 'Full Count',
  cycle: 'Cycle Count',
  spot: 'Spot Check',
}

export const CountStatusSchema = z.enum(['scheduled', 'in_progress', 'completed', 'cancelled'])
export type CountStatus = z.infer<typeof CountStatusSchema>

export const COUNT_STATUS_LABELS: Record<CountStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const AdjustmentReasonCodeSchema = z.enum([
  'damaged',
  'miscounted',
  'expired',
  'theft',
  'write_off',
  'found',
])
export type AdjustmentReasonCode = z.infer<typeof AdjustmentReasonCodeSchema>

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReasonCode, string> = {
  damaged: 'Damaged',
  miscounted: 'Miscounted',
  expired: 'Expired',
  theft: 'Theft / Loss',
  write_off: 'Write-off',
  found: 'Found (Surplus)',
}

export const CreateCountFormSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  countType: CountTypeSchema,
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
})
export type CreateCountFormValues = z.infer<typeof CreateCountFormSchema>

export const CountLineSubmitSchema = z.object({
  itemId: z.string(),
  variantId: z.string().optional(),
  batchId: z.string().optional(),
  locationId: z.string().optional(),
  expectedQty: z.number(),
  countedQty: z.number().min(0, 'Counted quantity cannot be negative'),
})
export type CountLineSubmit = z.infer<typeof CountLineSubmitSchema>

export const SubmitCountFormSchema = z.object({
  lines: z.array(CountLineSubmitSchema).min(1, 'At least one line is required'),
})
export type SubmitCountFormValues = z.infer<typeof SubmitCountFormSchema>

const CountWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
})

export const CountSummarySchema = z.object({
  id: z.string(),
  warehouse: CountWarehouseSchema.optional().nullable(),
  countType: CountTypeSchema,
  status: CountStatusSchema,
  scheduledDate: z.string().optional().nullable(),
  startedAt: z.string().optional().nullable(),
  completedAt: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  createdBy: z.object({ id: z.string(), name: z.string() }).optional().nullable(),
})

export const CountListResponseSchema = z.object({
  data: z.array(CountSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export type CountSummary = z.infer<typeof CountSummarySchema>
export type CountListResponse = z.infer<typeof CountListResponseSchema>

export const CreateAdjustmentFormSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  adjustmentDate: z.string().min(1, 'Date is required'),
  reasonCode: AdjustmentReasonCodeSchema,
  notes: z.string().min(1, 'Notes are required').max(1000),
  lines: z
    .array(
      z.object({
        itemId: z.string().min(1),
        variantId: z.string().optional(),
        batchId: z.string().optional(),
        locationId: z.string().optional(),
        expectedQty: z.number(),
        actualQty: z.number().min(0),
        unitCost: z.number().min(0).optional(),
      })
    )
    .min(1, 'At least one line is required'),
})
export type CreateAdjustmentFormValues = z.infer<typeof CreateAdjustmentFormSchema>
