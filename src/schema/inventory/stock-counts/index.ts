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

// Scenario 87 — the preset half of a Count Sheet line's Remarks (the other
// half is free text: for a unit not in store, its location and reference no.).
export const CountRemarkTagSchema = z.enum([
  'found_on_main_shelf',
  'defective',
  'yellowish',
  'lacking_parts',
])
export type CountRemarkTag = z.infer<typeof CountRemarkTagSchema>

export const COUNT_REMARK_TAG_LABELS: Record<CountRemarkTag, string> = {
  found_on_main_shelf: 'Found on main shelf',
  defective: 'Defective',
  yellowish: 'Yellowish',
  lacking_parts: 'Lacking parts',
}

export const CountLineSubmitSchema = z.object({
  itemId: z.string(),
  batchId: z.string().optional(),
  locationId: z.string().optional(),
  // Scenario 19 Part 5 — present only for a serial-level line; matches by
  // serial instead of item/batch/location.
  serialNumberId: z.string().optional(),
  countedQty: z.number().min(0, 'Counted quantity cannot be negative'),
  remarkTag: CountRemarkTagSchema.optional(),
  remarks: z.string().max(500, 'Remarks can be at most 500 characters').optional(),
})
export type CountLineSubmit = z.infer<typeof CountLineSubmitSchema>

export const SubmitCountFormSchema = z.object({
  lines: z.array(CountLineSubmitSchema).min(1, 'At least one line is required'),
})
export type SubmitCountFormValues = z.infer<typeof SubmitCountFormSchema>

// The system-of-record snapshot taken when a count starts — systemQty is
// never caller-supplied, so the UI only ever displays it, never edits it.
export const CountLineSnapshotSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  item: z.object({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
    modelNumber: z.string().nullable().optional(),
    brand: z.object({ name: z.string() }).nullable().optional(),
  }),
  batchId: z.string().optional().nullable(),
  batch: z.object({ id: z.string(), batchNumber: z.string() }).optional().nullable(),
  locationId: z.string().optional().nullable(),
  location: z
    .object({ id: z.string(), code: z.string(), name: z.string().optional().nullable() })
    .optional()
    .nullable(),
  // Scenario 19 Part 5 — set only for a serial-tracked item's line;
  // systemQty is always 1 (expected present) or 0 (a genuine find start()
  // couldn't have known about).
  serialNumberId: z.string().optional().nullable(),
  serialNumber: z
    .object({ id: z.string(), serialNumber: z.string(), status: z.string() })
    .optional()
    .nullable(),
  systemQty: z.coerce.number(),
  countedQty: z.coerce.number().optional().nullable(),
  countedAt: z.string().optional().nullable(),
  remarkTag: CountRemarkTagSchema.optional().nullable(),
  remarks: z.string().optional().nullable(),
})
export type CountLineSnapshot = z.infer<typeof CountLineSnapshotSchema>

export const CountLinesResponseSchema = z.array(CountLineSnapshotSchema)

// Scenario 19 Part 1 — a live, persisted "add item not covered by the
// start-time snapshot" endpoint, distinct from (and simpler than) just
// submitting a countedQty for an unlisted item at submit() time.
export const AddCountLineFormSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  batchId: z.string().optional(),
  locationId: z.string().optional(),
  serialNumberId: z.string().optional(),
})
export type AddCountLineFormValues = z.infer<typeof AddCountLineFormSchema>

// Scenario 87 — one line's progress, saved as the counter goes.
export const UpdateCountLineSchema = z.object({
  countedQty: z.number().min(0).optional(),
  remarkTag: CountRemarkTagSchema.nullable().optional(),
  remarks: z.string().max(500).nullable().optional(),
})
export type UpdateCountLineValues = z.infer<typeof UpdateCountLineSchema>

const CountWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  branch: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
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
