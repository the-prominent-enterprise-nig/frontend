import { z } from 'zod'

// ─── Write schemas (create/edit form) ───────────────────────────────────────
// Mirrors CreatePrLineSchema / CreatePurchaseRequestFormSchema from
// src/schema/inventory/purchase-requests — a ServiceDraft is a reopenable
// materials estimate for an install job, edited the same way a PR is: a
// title/customer/notes header plus N estimated-material lines.

export const CreateServiceDraftLineSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  // Plain z.number() (not .coerce) — mirrors CreatePrLineSchema. NumericInput
  // already emits a JS number via its onChange, and z.coerce.number() inside
  // a useFieldArray array item breaks zodResolver's generic inference under
  // zod v4 (input type collapses to `unknown`, output type stays `number`).
  estimatedQty: z.number().positive('Estimated quantity must be greater than 0'),
  notes: z.string().max(500).optional(),
})

export const CreateServiceDraftFormSchema = z.object({
  // Optional fallback used only when the caller has no branchId of their own
  // (Business Owner) — branch-scoped actors (Cashier/Branch Manager) have
  // their branchId force-resolved server-side regardless of what's submitted
  // here. Mirrors CreatePurchaseRequestFormSchema's branchId handling exactly.
  branchId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  customerId: z.string().optional(),
  posTransactionId: z.string().optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(CreateServiceDraftLineSchema).min(1, 'Add at least one estimated material line'),
})

// PATCH bulk-replaces the same fields as POST, so the update form shares the
// create schema — same precedent as UpdatePurchaseRequestFormSchema.
export const UpdateServiceDraftFormSchema = CreateServiceDraftFormSchema

// ─── Read schemas (list/detail display) ─────────────────────────────────────

export const ServiceDraftStatusSchema = z.enum([
  'draft',
  'sourcing',
  'installing',
  'completed',
  'cancelled',
])

const ServiceDraftLineItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
})

export const ServiceDraftLineSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  item: ServiceDraftLineItemSchema,
  estimatedQty: z.coerce.number(),
  actualQty: z.coerce.number().nullable().optional(),
  source: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

const ServiceDraftBranchSchema = z.object({
  id: z.string(),
  name: z.string(),
})

const ServiceDraftCustomerSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
})

export const ServiceDraftSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: ServiceDraftStatusSchema,
  notes: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  customer: ServiceDraftCustomerSchema.nullable().optional(),
  posTransactionId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  branch: ServiceDraftBranchSchema.nullable().optional(),
  lines: z.array(ServiceDraftLineSchema),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
})

export const ServiceDraftListResponseSchema = z.object({
  data: z.array(ServiceDraftSchema),
  total: z.number().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
})

export type CreateServiceDraftLineValues = z.infer<typeof CreateServiceDraftLineSchema>
export type CreateServiceDraftFormValues = z.infer<typeof CreateServiceDraftFormSchema>
export type UpdateServiceDraftFormValues = z.infer<typeof UpdateServiceDraftFormSchema>
export type ServiceDraftStatus = z.infer<typeof ServiceDraftStatusSchema>
export type ServiceDraftLine = z.infer<typeof ServiceDraftLineSchema>
export type ServiceDraft = z.infer<typeof ServiceDraftSchema>
export type ServiceDraftListResponse = z.infer<typeof ServiceDraftListResponseSchema>
