import { z } from 'zod'

// Re-exports from stock-counts for cycle count specifics
export {
  CountTypeSchema,
  CountStatusSchema,
  COUNT_TYPE_LABELS,
  COUNT_STATUS_LABELS,
} from '@/src/schema/inventory/stock-counts'
export type {
  CountType,
  CountStatus,
  CountSummary,
  CountListResponse,
} from '@/src/schema/inventory/stock-counts'

export const ScheduleCycleCountFormSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  scheduledDate: z.string().min(1, 'Scheduled date is required'),
  notes: z.string().max(500).optional(),
})
export type ScheduleCycleCountFormValues = z.infer<typeof ScheduleCycleCountFormSchema>
