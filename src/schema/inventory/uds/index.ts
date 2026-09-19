import { z } from 'zod'

export const UDS_REASONS = ['repair', 'maintenance', 'quality_check', 'pull_out', 'loan'] as const
export const UDS_STATUSES = [
  'issued',
  'in_transit',
  'received',
  // Scenario 47 — the service-centre legs. Reached only through their own
  // endpoints, never the generic status setter, because each carries side
  // effects (consigning the serial, recording the DR/RR, posting the variance).
  'at_provider',
  'repaired',
  'completed',
  'cancelled',
] as const
export const UDS_ASSESSMENTS = ['repairable', 'unrepairable'] as const

export const UdsReasonSchema = z.enum(UDS_REASONS)
export const UdsStatusSchema = z.enum(UDS_STATUSES)
export const UdsAssessmentSchema = z.enum(UDS_ASSESSMENTS)

export type UdsReason = z.infer<typeof UdsReasonSchema>
export type UdsStatus = z.infer<typeof UdsStatusSchema>
export type UdsAssessment = z.infer<typeof UdsAssessmentSchema>

/**
 * An id field the form leaves empty rather than unset.
 *
 * A `<select>` with nothing chosen holds `''`, and the API validates these as
 * UUIDs — class-validator's `@IsOptional()` waives validation for `undefined`
 * and `null` only, so an untouched picker posts `''` and comes back as
 * "repairProviderId must be a UUID". Narrowing it to `undefined` here means
 * the empty field is simply not sent, which is what "optional" meant.
 */
const optionalId = z
  .string()
  .optional()
  .transform((v) => (v === '' ? undefined : v))

// ─── Create UDS ───────────────────────────────────────────────────────────────

const UdsLineFormSchema = z.object({
  serialNumberId: z.string().min(1, 'Serial number is required'),
  issueReason: z.string().max(500).optional(),
  notes: z.string().max(500).optional(),
})

export const CreateUdsFormSchema = z.object({
  warehouseId: optionalId,
  reason: UdsReasonSchema,
  expectedReturnDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  rfsFormFileId: optionalId,
  repairProviderId: optionalId,
  lines: z.array(UdsLineFormSchema).min(1, 'At least one unit is required'),
})

export type CreateUdsFormValues = z.infer<typeof CreateUdsFormSchema>

// ─── Update UDS Status ────────────────────────────────────────────────────────

/** The provider legs are excluded: dispatching and taking a unit back go
 * through their own forms, which capture the DR/RR and the actual cost. */
export const ManualUdsStatusSchema = z.enum([
  'issued',
  'in_transit',
  'received',
  'completed',
  'cancelled',
])

export type ManualUdsStatus = z.infer<typeof ManualUdsStatusSchema>

export const UpdateUdsStatusFormSchema = z.object({
  status: ManualUdsStatusSchema,
  notes: z.string().max(1000).optional(),
  /** The SI for the branch <-> main leg. Only meaningful on the two
   *  transitions where the unit makes that trip — the server writes it to the
   *  outbound column on in_transit and the return column on completed, and
   *  ignores it anywhere else. */
  salesInvoiceNumber: z.string().max(50).optional(),
})

export type UpdateUdsStatusFormValues = z.infer<typeof UpdateUdsStatusFormSchema>

// ─── Set Repair Provider ─────────────────────────────────────────────────────

export const SetRepairProviderFormSchema = z.object({
  repairProviderId: z.string().min(1, 'Repair provider is required'),
})

export type SetRepairProviderFormValues = z.infer<typeof SetRepairProviderFormSchema>

// ─── Assess UDS ───────────────────────────────────────────────────────────────

export const AssessUdsFormSchema = z
  .object({
    assessment: UdsAssessmentSchema,
    /** Zero is a real estimate: a warranty or goodwill repair costs nothing
     *  and still has to be assessed, priced and sent to a provider. It is
     *  `undefined` — never answered — that blocks a repairable verdict. */
    estimatedCost: z.coerce.number().min(0, 'Estimated cost cannot be negative').optional(),
    /** Bound to the sheet as part of the verdict. A sheet raised from a
     *  customer return has no provider — the intake never asks — so requiring
     *  one to be set beforehand made every custodial repair fail its first
     *  assessment. Only required when the sheet does not already have one. */
    repairProviderId: optionalId,
    notes: z.string().max(1000).optional(),
  })
  .refine((data) => data.assessment !== 'repairable' || data.estimatedCost != null, {
    message: 'Estimated cost is required when the unit is repairable',
    path: ['estimatedCost'],
  })

export type AssessUdsFormValues = z.infer<typeof AssessUdsFormSchema>

// ─── Write Off UDS ────────────────────────────────────────────────────────────

export const DispatchToProviderFormSchema = z.object({
  deliveryReceiptNumber: z
    .string()
    .min(1, 'DR number is required')
    .max(50, 'DR number is too long'),
  notes: z.string().max(1000).optional(),
})

export type DispatchToProviderFormValues = z.infer<typeof DispatchToProviderFormSchema>

export const ReceiveFromProviderFormSchema = z.object({
  receivingReportNumber: z
    .string()
    .min(1, 'RR number is required')
    .max(50, 'RR number is too long'),
  /** Zero is a real figure — the provider fixed it under warranty and billed
   *  nothing. Against a non-zero estimate it posts the whole accrual back as
   *  a saving, which is exactly right. */
  actualCost: z.coerce.number().min(0, 'Actual cost cannot be negative'),
  notes: z.string().max(1000).optional(),
})

export type ReceiveFromProviderFormValues = z.infer<typeof ReceiveFromProviderFormSchema>

export const ReleaseToCustomerFormSchema = z.object({
  // The DR that closes the journey is issued server-side
  // (UdsService#generateCustomerDeliveryReceiptNumber) and comes back on the
  // response — the form never sends one.
  /** The SI for the unit's return leg to the branch. Captured here because a
   *  customer-owned sheet can only be closed by releasing it. */
  salesInvoiceNumber: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
})

export type ReleaseToCustomerFormValues = z.infer<typeof ReleaseToCustomerFormSchema>

export const WriteOffUdsFormSchema = z.object({
  unitCost: z.coerce.number().positive('Unit cost is required'),
  notes: z.string().max(1000).optional(),
})

export type WriteOffUdsFormValues = z.infer<typeof WriteOffUdsFormSchema>

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
  // Each branch has exactly one warehouse — the UI displays this branch name
  // rather than the warehouse's own "{branch} Warehouse" name.
  branch: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
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
  assessment: UdsAssessmentSchema.optional().nullable(),
  assessmentNotes: z.string().optional().nullable(),
  assessedAt: z.string().optional().nullable(),
  assessedById: z.string().optional().nullable(),
  repairEstimatedCost: z.coerce.number().optional().nullable(),
  // Scenario 47 — the provider legs.
  dispatchDeliveryReceiptNumber: z.string().optional().nullable(),
  dispatchedAt: z.string().optional().nullable(),
  returnReceivingReportNumber: z.string().optional().nullable(),
  returnedAt: z.string().optional().nullable(),
  repairActualCost: z.coerce.number().optional().nullable(),
  repairVarianceJournalEntryId: z.string().optional().nullable(),
  // Scenario 48 — the customer ends. A UDS with a customerId holds their
  // property, not our stock.
  customerId: z.string().optional().nullable(),
  customer: z.object({ id: z.string(), name: z.string() }).optional().nullable(),
  intakeReceivingReportNumber: z.string().optional().nullable(),
  intakeSalesInvoiceNumber: z.string().optional().nullable(),
  releaseDeliveryReceiptNumber: z.string().optional().nullable(),
  // The branch <-> main leg. On a custodial sheet there is no stock transfer
  // for this hop, so the timestamp and actor here are the only record that the
  // handover happened.
  /** The gate pass the unit physically travels on for the branch <-> main hop.
   *  Not a stock transfer — a custodial unit has no stock to move. */
  transferToMainCustodyNumber: z.string().optional().nullable(),
  returnToBranchCustodyNumber: z.string().optional().nullable(),
  transferToMainSalesInvoiceNumber: z.string().optional().nullable(),
  transferredToMainAt: z.string().optional().nullable(),
  transferredToMainById: z.string().optional().nullable(),
  returnToBranchSalesInvoiceNumber: z.string().optional().nullable(),
  returnedToBranchAt: z.string().optional().nullable(),
  returnedToBranchById: z.string().optional().nullable(),
  releasedAt: z.string().optional().nullable(),
  repairDebitJournalEntryId: z.string().optional().nullable(),
  writeOffAdjustmentId: z.string().optional().nullable(),
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
  at_provider: 'At Service Centre',
  repaired: 'Repaired',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const UDS_STATUS_STYLES: Record<UdsStatus, string> = {
  issued: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-yellow-100 text-yellow-700',
  received: 'bg-purple-100 text-purple-700',
  at_provider: 'bg-amber-100 text-amber-700',
  repaired: 'bg-teal-100 text-teal-700',
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

export const UDS_ASSESSMENT_LABELS: Record<UdsAssessment, string> = {
  repairable: 'Repairable',
  unrepairable: 'Unrepairable',
}

export const UDS_ASSESSMENT_STYLES: Record<UdsAssessment, string> = {
  repairable: 'bg-green-100 text-green-700',
  unrepairable: 'bg-red-100 text-red-700',
}
