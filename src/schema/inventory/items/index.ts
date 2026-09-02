import { z } from 'zod'

export const CostingMethodSchema = z.enum(['fifo', 'lifo', 'weighted_average'])
export const ItemLifecycleSchema = z.enum(['active', 'discontinued', 'archived'])

// Scenario 16 — Item Master Governance: gates new-item creation only, not
// edits to already-approved items.
export const ItemApprovalStatusSchema = z.enum([
  'draft',
  'pending_accounting_confirmation',
  'pending_approval',
  'approved',
  'rejected',
])
export type ItemApprovalStatus = z.infer<typeof ItemApprovalStatusSchema>

export const ItemTagLabelSchema = z.enum(['best_seller', 'holiday', 'clearance', 'new_arrival'])
export type ItemTagLabel = z.infer<typeof ItemTagLabelSchema>

export const ItemTagAssignmentSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  tag: ItemTagLabelSchema,
  createdAt: z.string(),
})
export type ItemTagAssignment = z.infer<typeof ItemTagAssignmentSchema>

export const ItemChangeLogSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  field: z.string(),
  oldValue: z.string().nullable().optional(),
  newValue: z.string().nullable().optional(),
  changedBy: z.string().nullable().optional(),
  changedAt: z.string(),
})
export type ItemChangeLog = z.infer<typeof ItemChangeLogSchema>

// ─── Classification option shapes ────────────────────────────────────────────

export const ClassificationOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type ClassificationOption = z.infer<typeof ClassificationOptionSchema>

/**
 * Schema for the Create Item form.
 * tenantId is injected server-side and is NOT part of this form schema.
 */
const CreateItemFormBaseSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(120),
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(60)
    .regex(/^[A-Za-z0-9\-_]+$/, 'SKU may only contain letters, numbers, hyphens, and underscores'),
  baseUnitId: z.string().min(1, 'Unit of measure is required'),
  primaryCategoryId: z.string().min(1, 'Category is required'),
  costPrice: z
    .number({ message: 'Cost price must be a number' })
    .min(0, 'Cost price must be 0 or greater'),
  description: z.string().max(500).optional(),
  sellingPrice: z.number().min(0).optional(),
  costingMethod: CostingMethodSchema,
  isBatchTracked: z.boolean(),
  isSerialTracked: z.boolean(),
  requiresSecondarySerial: z.boolean(),
  isExpiryTracked: z.boolean(),
  isBundle: z.boolean(),
  isService: z.boolean(),
  revenueAccountId: z.string().optional(),
  cogsAccountId: z.string().optional(),
  inventoryAccountId: z.string().optional(),
  lengthCm: z.number().min(0).optional(),
  widthCm: z.number().min(0).optional(),
  heightCm: z.number().min(0).optional(),
  weightKg: z.number().min(0).optional(),
  warrantyPeriodDays: z.number().int().min(0).optional(),
  brandId: z.string().optional(),
  typeId: z.string().optional(),
  modelNumber: z.string().max(60).optional(),
  // Optional — record one already-in-hand unit at creation time (date in /
  // RR # / origin / cost / serial). Left blank, no initial stock is recorded.
  initialWarehouseId: z.string().optional(),
  initialDateIn: z.string().optional(),
  initialRr: z.string().max(30, 'RR number must be 30 characters or fewer').optional(),
  initialOrigin: z.string().optional(),
  initialPrice: z.number().min(0).optional(),
  initialSerialNumber: z.string().optional(),
})

export const CreateItemFormSchema = CreateItemFormBaseSchema.superRefine((data, ctx) => {
  const hasAnyInitialStockField = !!(
    data.initialWarehouseId ||
    data.initialDateIn ||
    data.initialRr ||
    data.initialOrigin ||
    data.initialPrice != null ||
    data.initialSerialNumber
  )
  if (!hasAnyInitialStockField) return

  if (!data.initialWarehouseId) {
    ctx.addIssue({
      code: 'custom',
      path: ['initialWarehouseId'],
      message: 'Warehouse is required to record initial stock',
    })
  }
  if (!data.initialDateIn) {
    ctx.addIssue({
      code: 'custom',
      path: ['initialDateIn'],
      message: 'Date received is required to record initial stock',
    })
  }
  if (!data.initialRr) {
    ctx.addIssue({
      code: 'custom',
      path: ['initialRr'],
      message: 'RR number is required to record initial stock',
    })
  }
  if (data.isSerialTracked && !data.initialSerialNumber) {
    ctx.addIssue({
      code: 'custom',
      path: ['initialSerialNumber'],
      message: 'Serial number is required for a serial-tracked item',
    })
  }
  if (!data.isSerialTracked && data.initialSerialNumber) {
    ctx.addIssue({
      code: 'custom',
      path: ['initialSerialNumber'],
      message: 'Remove the serial number — this item is not serial-tracked',
    })
  }
})

export const UpdateItemFormSchema = z.object({
  name: z.string().min(1, 'Item name is required').max(120).optional(),
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(60)
    .regex(/^[A-Za-z0-9\-_]+$/, 'SKU may only contain letters, numbers, hyphens, and underscores')
    .optional(),
  baseUnitId: z.string().min(1, 'Unit of measure is required').optional(),
  primaryCategoryId: z.string().min(1, 'Category is required').optional(),
  costPrice: z.number().min(0, 'Cost price must be 0 or greater').optional(),
  description: z.string().max(500).optional(),
  sellingPrice: z.number().min(0).optional(),
  costingMethod: CostingMethodSchema,
  isBatchTracked: z.boolean(),
  isSerialTracked: z.boolean(),
  requiresSecondarySerial: z.boolean(),
  isExpiryTracked: z.boolean(),
  isBundle: z.boolean(),
  isService: z.boolean(),
  revenueAccountId: z.string().optional(),
  cogsAccountId: z.string().optional(),
  inventoryAccountId: z.string().optional(),
  lengthCm: z.number().min(0).optional(),
  widthCm: z.number().min(0).optional(),
  heightCm: z.number().min(0).optional(),
  weightKg: z.number().min(0).optional(),
  warrantyPeriodDays: z.number().int().min(0).optional(),
  brandId: z.string().optional(),
  typeId: z.string().optional(),
  modelNumber: z.string().max(60).optional(),
})

export const UpdateLifecycleFormSchema = z.object({
  lifecycle: ItemLifecycleSchema,
})

// ─── Item Master Governance forms (Scenario 16) ────────────────────────────

export const ConfirmAccountingFormSchema = z.object({
  remarks: z.string().max(500).optional(),
})

export const RejectAccountingFormSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason must be 500 characters or less'),
})

export const ApproveItemFormSchema = z.object({
  remarks: z.string().max(500).optional(),
})

export const RejectItemFormSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500, 'Reason must be 500 characters or less'),
})

export type CreateItemFormValues = z.infer<typeof CreateItemFormSchema>
export type UpdateItemFormValues = z.infer<typeof UpdateItemFormSchema>
export type UpdateLifecycleFormValues = z.infer<typeof UpdateLifecycleFormSchema>
export type ConfirmAccountingFormValues = z.infer<typeof ConfirmAccountingFormSchema>
export type RejectAccountingFormValues = z.infer<typeof RejectAccountingFormSchema>
export type ApproveItemFormValues = z.infer<typeof ApproveItemFormSchema>
export type RejectItemFormValues = z.infer<typeof RejectItemFormSchema>

// Scenario 16 gap #3 — near-duplicate warning (non-blocking, trigram
// similarity on name). The hard duplicate block stays the SKU uniqueness
// check, surfaced separately via the 'duplicate_sku' error code.
export const DuplicateCandidateSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  brandName: z.string().nullable(),
  similarity: z.coerce.number(),
})
export type DuplicateCandidate = z.infer<typeof DuplicateCandidateSchema>

const classificationRefSchema = z.object({ id: z.string(), name: z.string() }).nullable().optional()

/** Minimal shape returned by the list endpoint (content is untyped in OpenAPI spec) */
export const ItemSummarySchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  costPrice: z.coerce.number().nullable().optional(),
  sellingPrice: z.coerce.number().nullable().optional(),
  lifecycle: ItemLifecycleSchema.optional(),
  approvalStatus: ItemApprovalStatusSchema.optional(),
  submittedAt: z.string().nullable().optional(),
  accountingConfirmedAt: z.string().nullable().optional(),
  approvedAt: z.string().nullable().optional(),
  rejectedAt: z.string().nullable().optional(),
  rejectedReason: z.string().nullable().optional(),
  // "Group/Subgroup" classification lives on the category's own parent —
  // primaryCategory is the leaf (subgroup), parentCategory is the group.
  primaryCategory: z
    .object({
      id: z.string(),
      name: z.string(),
      parentCategory: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
    })
    .nullable()
    .optional(),
  baseUnit: z.object({ id: z.string(), name: z.string(), code: z.string() }).nullable().optional(),
  createdAt: z.string().optional(),
  revenueAccountId: z.string().nullable().optional(),
  cogsAccountId: z.string().nullable().optional(),
  inventoryAccountId: z.string().nullable().optional(),
  brand: classificationRefSchema,
  type: classificationRefSchema,
  modelNumber: z.string().nullable().optional(),
  _count: z.object({ serialNumbers: z.number() }).optional(),
  isBatchTracked: z.preprocess((v) => {
    if (v === true || v === 'true' || v === 1) return true
    if (v === false || v === 'false' || v === 0) return false
    return undefined
  }, z.boolean().optional()),
  isSerialTracked: z.preprocess((v) => {
    if (v === true || v === 'true' || v === 1) return true
    if (v === false || v === 'false' || v === 0) return false
    return undefined
  }, z.boolean().optional()),
  requiresSecondarySerial: z.preprocess((v) => {
    if (v === true || v === 'true' || v === 1) return true
    if (v === false || v === 'false' || v === 0) return false
    return undefined
  }, z.boolean().optional()),
  isExpiryTracked: z.preprocess((v) => {
    if (v === true || v === 'true' || v === 1) return true
    if (v === false || v === 'false' || v === 0) return false
    return undefined
  }, z.boolean().optional()),
  isBundle: z.preprocess((v) => {
    if (v === true || v === 'true' || v === 1) return true
    if (v === false || v === 'false' || v === 0) return false
    return undefined
  }, z.boolean().optional()),
  isService: z.preprocess((v) => {
    if (v === true || v === 'true' || v === 1) return true
    if (v === false || v === 'false' || v === 0) return false
    return undefined
  }, z.boolean().optional()),
  lengthCm: z.coerce.number().nullable().optional(),
  widthCm: z.coerce.number().nullable().optional(),
  heightCm: z.coerce.number().nullable().optional(),
  weightKg: z.coerce.number().nullable().optional(),
  warrantyPeriodDays: z.coerce.number().nullable().optional(),
})

// The backend nests pagination under `meta` (`{ data, meta: { total, page,
// limit, lastPage } }`), not at the top level. This schema previously
// expected total/page/limit flat, which never matched — safeParse always
// failed and every caller silently fell back to raw, unvalidated backend
// data (see get-items.ts), so ItemSummarySchema's z.coerce.number() fields
// (costPrice, etc.) never actually ran and reached the client as strings.
// Parsing the real shape and transforming it back to the flat shape keeps
// every existing consumer of ItemListResponse unchanged.
export const ItemListResponseSchema = z
  .object({
    data: z.array(ItemSummarySchema),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
    }),
  })
  .transform(({ data, meta }) => ({
    data,
    total: meta.total,
    page: meta.page,
    limit: meta.limit,
  }))

export type ItemSummary = z.infer<typeof ItemSummarySchema>
export type ItemListResponse = z.infer<typeof ItemListResponseSchema>

/** Minimal shape for category & UOM dropdown options */
export const CategoryOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().optional(),
})

export const UomOptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  isBaseUnit: z.boolean().optional(),
  allowDecimal: z.boolean().optional(),
})

export const CategoryListResponseSchema = z.object({
  data: z.array(CategoryOptionSchema),
  total: z.number().optional(),
})

export const UomListResponseSchema = z.object({
  data: z.array(UomOptionSchema),
  total: z.number().optional(),
})

export type CategoryOption = z.infer<typeof CategoryOptionSchema>
export type UomOption = z.infer<typeof UomOptionSchema>
