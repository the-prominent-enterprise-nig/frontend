import { z } from 'zod'
import { AdjustmentReasonCodeSchema } from '@/src/schema/inventory/stock-counts'

// Scenario 29 RR-05 — async submit-then-approve, self-approval blocked in
// service logic (the submitter and approver must be different people).
export const ManualReceivingReportStatusSchema = z.enum(['pending', 'approved', 'rejected'])
export type ManualReceivingReportStatus = z.infer<typeof ManualReceivingReportStatusSchema>

export const MANUAL_RR_STATUS_LABELS: Record<ManualReceivingReportStatus, string> = {
  pending: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
}

const ManualRrItemSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  isSerialTracked: z.boolean().optional(),
})

const ManualRrWarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  branchId: z.string().nullable().optional(),
})

const ManualRrCreatedSerialSchema = z.object({
  id: z.string(),
  serialNumber: z.string(),
  status: z.string(),
})

const ManualRrSupplierSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
})

export const ManualReceivingReportSchema = z.object({
  id: z.string(),
  code: z.string(),
  item: ManualRrItemSchema,
  warehouse: ManualRrWarehouseSchema,
  serialNumber: z.string(),
  reasonCode: AdjustmentReasonCodeSchema,
  notes: z.string().optional().nullable(),
  status: ManualReceivingReportStatusSchema,
  submittedById: z.string(),
  submittedByName: z.string().optional().nullable(),
  submittedAt: z.string(),
  approvedById: z.string().optional().nullable(),
  approvedByName: z.string().optional().nullable(),
  approvedAt: z.string().optional().nullable(),
  rejectedById: z.string().optional().nullable(),
  rejectedByName: z.string().optional().nullable(),
  rejectedAt: z.string().optional().nullable(),
  rejectedReason: z.string().optional().nullable(),
  createdSerialId: z.string().optional().nullable(),
  createdSerial: ManualRrCreatedSerialSchema.optional().nullable(),
  createdAt: z.string().optional(),
  // Scenario 36 Gap 3 — a manually-originated unit is a real inbound stock
  // event now: unitCost/withheldAmount are Decimal fields, so they come
  // back as strings over the API (same convention as every other Decimal
  // field in this codebase) — coerce with Number() at display time.
  unitCost: z.union([z.string(), z.number()]).optional().nullable(),
  supplierId: z.string().optional().nullable(),
  supplier: ManualRrSupplierSchema.optional().nullable(),
  withholding: z.string().optional(),
  withheldAmount: z.union([z.string(), z.number()]).optional().nullable(),
  journalEntryId: z.string().optional().nullable(),
})
export type ManualReceivingReport = z.infer<typeof ManualReceivingReportSchema>

export const ManualReceivingReportListResponseSchema = z.object({
  data: z.array(ManualReceivingReportSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
  }),
})
export type ManualReceivingReportListResponse = z.infer<
  typeof ManualReceivingReportListResponseSchema
>

export const CreateManualReceivingReportFormSchema = z
  .object({
    itemId: z.string().min(1, 'Item is required'),
    warehouseId: z.string().min(1, 'Warehouse is required'),
    serialNumber: z.string().min(1, 'Serial number is required').max(150),
    reasonCode: AdjustmentReasonCodeSchema,
    notes: z.string().max(1000).optional(),
    // Scenario 36 Gap 3 — both optional: a report with no cost/supplier
    // stays costless (no GL posting), same as a blank-cost line on normal
    // receiving. Plain (not z.coerce) so react-hook-form's generic stays
    // number|undefined — the input's onChange converts '' to undefined
    // itself (see CreateManualRrModal.tsx) rather than relying on a
    // preprocess step, which breaks zodResolver's input/output typing.
    unitCost: z.number().positive().optional(),
    supplierId: z.string().optional(),
  })
  .refine((data) => !data.unitCost || data.supplierId, {
    message: 'A supplier is required when a unit cost is given.',
    path: ['supplierId'],
  })
export type CreateManualReceivingReportFormValues = z.infer<
  typeof CreateManualReceivingReportFormSchema
>

export const RejectManualReceivingReportFormSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
})
export type RejectManualReceivingReportFormValues = z.infer<
  typeof RejectManualReceivingReportFormSchema
>
