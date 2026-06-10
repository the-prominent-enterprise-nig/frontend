import { z } from 'zod'

export const REASON_CODES = [
  'year_end_writedown',
  'market_correction',
  'error_fix',
  'other',
] as const

export const REASON_CODE_LABELS: Record<(typeof REASON_CODES)[number], string> = {
  year_end_writedown: 'Year-End Write-down',
  market_correction: 'Market Correction',
  error_fix: 'Error Fix',
  other: 'Other',
}

export const ReasonCodeEnum = z.enum(REASON_CODES)
export type ReasonCode = z.infer<typeof ReasonCodeEnum>

export const RevaluationRecordSchema = z.object({
  id: z.string(),
  item: z.object({ id: z.string(), name: z.string(), sku: z.string() }).optional(),
  warehouse: z.object({ id: z.string(), name: z.string(), code: z.string() }).optional(),
  oldCost: z.number().optional(),
  newCost: z.number(),
  reasonCode: z.string(),
  notes: z.string(),
  createdAt: z.string(),
  createdBy: z.string().optional(),
})

export const RevaluationListResponseSchema = z.object({
  data: z.array(RevaluationRecordSchema),
  total: z.number().optional(),
})

export const CreateRevaluationFormSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  newCost: z.number().positive('New cost must be greater than 0'),
  reasonCode: ReasonCodeEnum,
  notes: z.string().min(10, 'Notes must be at least 10 characters'),
})

export type RevaluationRecord = z.infer<typeof RevaluationRecordSchema>
export type RevaluationListResponse = z.infer<typeof RevaluationListResponseSchema>
export type CreateRevaluationFormValues = z.infer<typeof CreateRevaluationFormSchema>
