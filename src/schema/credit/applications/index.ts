import { z } from 'zod'

export const CreditApplicationStatusSchema = z.enum([
  'draft',
  'submitted',
  'under_investigation',
  'pending_approval',
  'approved',
  'partially_approved',
  'declined',
  'cancelled',
])
export type CreditApplicationStatus = z.infer<typeof CreditApplicationStatusSchema>

export const CREDIT_APPLICATION_STATUS_LABELS: Record<CreditApplicationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_investigation: 'Under Investigation',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  partially_approved: 'Partially Approved',
  declined: 'Declined',
  cancelled: 'Cancelled',
}

export const CREDIT_APPLICATION_STATUS_COLORS: Record<CreditApplicationStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  submitted: 'bg-blue-100 text-blue-700',
  under_investigation: 'bg-amber-100 text-amber-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  partially_approved: 'bg-orange-100 text-orange-700',
  declined: 'bg-red-100 text-red-600',
  cancelled: 'bg-red-100 text-red-600',
}

// Scenario 29 POS-02 — per-item status, independent of the application's
// own status above.
export const CreditApplicationItemStatusSchema = z.enum(['pending', 'approved', 'declined'])
export type CreditApplicationItemStatus = z.infer<typeof CreditApplicationItemStatusSchema>

export const CREDIT_APPLICATION_ITEM_STATUS_LABELS: Record<CreditApplicationItemStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  declined: 'Declined',
}

export const CREDIT_APPLICATION_ITEM_STATUS_COLORS: Record<CreditApplicationItemStatus, string> = {
  pending: 'bg-zinc-100 text-zinc-600',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-600',
}

export const CreditApplicationDocumentTypeSchema = z.enum([
  'applicant_id',
  'applicant_income_proof',
  'applicant_expense_proof',
  'co_maker_id',
  'co_maker_income_proof',
  'other',
])
export type CreditApplicationDocumentType = z.infer<typeof CreditApplicationDocumentTypeSchema>

export const CREDIT_APPLICATION_DOCUMENT_TYPE_LABELS: Record<
  CreditApplicationDocumentType,
  string
> = {
  applicant_id: 'Applicant ID',
  applicant_income_proof: 'Applicant Income Proof',
  applicant_expense_proof: 'Applicant Expense Proof',
  co_maker_id: 'Co-Maker ID',
  co_maker_income_proof: 'Co-Maker Income Proof',
  other: 'Other',
}

export const CreditInvestigationOutcomeSchema = z.enum(['recommend_approve', 'recommend_decline'])
export type CreditInvestigationOutcome = z.infer<typeof CreditInvestigationOutcomeSchema>

export const CREDIT_INVESTIGATION_OUTCOME_LABELS: Record<CreditInvestigationOutcome, string> = {
  recommend_approve: 'Recommend Approve',
  recommend_decline: 'Recommend Decline',
}

export const CREDIT_INVESTIGATION_OUTCOME_COLORS: Record<CreditInvestigationOutcome, string> = {
  recommend_approve: 'bg-green-100 text-green-700',
  recommend_decline: 'bg-red-100 text-red-600',
}

export const RecordCreditInvestigationFormSchema = z.object({
  affordabilityOutcome: CreditInvestigationOutcomeSchema,
  notes: z.string().max(4000).optional(),
})
export type RecordCreditInvestigationFormValues = z.infer<
  typeof RecordCreditInvestigationFormSchema
>

export interface CreditInvestigation {
  id: string
  creditApplicationId: string
  affordabilityOutcome: CreditInvestigationOutcome
  notes?: string | null
  investigatedById: string
  investigatedAt: string
  createdAt: string
  updatedAt: string
}

export const CreateCreditApplicationFormSchema = z.object({
  // Audit-only — not shown as a form field. Sent when the actor is
  // branch-locked; otherwise omitted and the backend defaults it to the
  // enterprise's main branch (see CreditApplicationService.create()).
  branchId: z.string().optional(),
  applicantCustomerId: z.string().min(1, 'Applicant is required'),
  coMakerId: z.string().min(1, 'Co-maker is required'),
  // An application can cover a bundle of models (2026-08-15, second pass) —
  // checkout enforces an exact match against the sale's installment lines.
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, 'Item is required'),
        variantId: z.string().optional(),
      })
    )
    .min(1, 'At least one item is required'),
  itemDescription: z.string().max(500).optional(),
})
export type CreateCreditApplicationFormValues = z.infer<typeof CreateCreditApplicationFormSchema>

// Editing a draft only ever touches item/variant/notes today (see
// CreditApplicationDetail's "Edit" action) — applicant/co-maker/branch
// aren't exposed for edit, but the backend's PATCH accepts any subset via
// PartialType(CreateCreditApplicationDto), so this stays a full .partial().
export const UpdateCreditApplicationFormSchema = CreateCreditApplicationFormSchema.partial()
export type UpdateCreditApplicationFormValues = z.infer<typeof UpdateCreditApplicationFormSchema>

export const CancelCreditApplicationFormSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
})
export type CancelCreditApplicationFormValues = z.infer<typeof CancelCreditApplicationFormSchema>

// Scenario 29 POS-02 — replaces the old whole-application decline. Every
// item on the application must appear in exactly one of the two lists.
export const DecideCreditApplicationItemsFormSchema = z.object({
  approveItemIds: z.array(z.string()),
  declineItemIds: z.array(z.string()),
  declineReason: z.string().max(500).optional(),
})
export type DecideCreditApplicationItemsFormValues = z.infer<
  typeof DecideCreditApplicationItemsFormSchema
>

export const AttachCreditApplicationDocumentFormSchema = z.object({
  fileId: z.string().min(1, 'File is required'),
  documentType: CreditApplicationDocumentTypeSchema,
})
export type AttachCreditApplicationDocumentFormValues = z.infer<
  typeof AttachCreditApplicationDocumentFormSchema
>

export interface CreditApplicationCustomerLite {
  id: string
  name: string
  customerCode: string
  phone?: string | null
  email?: string | null
}

export interface CreditApplicationCoMakerLite {
  id: string
  name: string
  relationship: string
  contactNumber: string
  email?: string | null
}

export interface CreditApplicationBranchLite {
  id: string
  name: string
  code?: string | null
}

export interface CreditApplicationItemLite {
  id: string
  name: string
  sku?: string | null
  modelNumber?: string | null
  hasVariants?: boolean
  sellingPrice?: number | null
}

export interface CreditApplicationVariantLite {
  id: string
  variantSku: string
  attributes?: Record<string, string> | null
  priceOverride?: number | null
}

export interface CreditApplicationItemLine {
  id: string
  itemId: string
  item?: CreditApplicationItemLite | null
  variantId?: string | null
  variant?: CreditApplicationVariantLite | null
  requestedAmount: number
  status: CreditApplicationItemStatus
  decidedAt?: string | null
  decidedById?: string | null
}

export interface CreditApplication {
  id: string
  tenantId: string
  applicationNumber: string
  branchId: string
  branch: CreditApplicationBranchLite
  applicantCustomerId: string
  applicantCustomer: CreditApplicationCustomerLite
  coMakerId: string
  coMaker: CreditApplicationCoMakerLite
  items: CreditApplicationItemLine[]
  requestedAmount: number
  itemDescription?: string | null
  status: CreditApplicationStatus
  createdById: string
  submittedAt?: string | null
  submittedById?: string | null
  investigatingAt?: string | null
  investigatingById?: string | null
  investigation?: CreditInvestigation | null
  approvedAt?: string | null
  approvedById?: string | null
  declinedAt?: string | null
  declinedById?: string | null
  declineReason?: string | null
  cancelledAt?: string | null
  cancelledById?: string | null
  cancelReason?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreditApplicationDocument {
  id: string
  creditApplicationId: string
  documentType: CreditApplicationDocumentType
  fileId: string
  uploadedById: string
  uploadedAt: string
  file: {
    id: string
    originalName: string
    mimeType: string
    size: number
    uploadedAt: string
  }
}

export interface CreditApplicationListResponse {
  data: CreditApplication[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface PromissoryNoteScheduleLine {
  lineNumber: number
  dueDate: string
  amount: number
}

export interface PromissoryNote {
  id: string
  creditApplicationId: string
  releaseFormRequestId: string
  /** Per-line installment financing (2026-08-06) — one note per cart line,
   * matching the line's own index in the originating sale's `lines[]`. */
  lineIndex: number
  financingTermId: string
  termMonths: number
  factorRate: number
  totalAmount: number
  downPayment: number
  amountFinanced: number
  totalPayable: number
  monthlyInstallment: number
  scheduleLines: PromissoryNoteScheduleLine[]
  generatedAt: string
  generatedById: string
  signedAt?: string | null
  signedById?: string | null
  createdAt: string
  updatedAt: string
}
