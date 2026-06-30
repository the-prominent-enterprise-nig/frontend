import { z } from 'zod'

export const CostingMethodSchema = z.enum(['fifo', 'lifo', 'weighted_average'])
export const ItemLifecycleSchema = z.enum(['active', 'discontinued', 'archived'])

export const ItemTagLabelSchema = z.enum(['best_seller', 'holiday', 'clearance', 'new_arrival'])
export type ItemTagLabel = z.infer<typeof ItemTagLabelSchema>

export const ItemTagAssignmentSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  tag: ItemTagLabelSchema,
  createdAt: z.string(),
})
export type ItemTagAssignment = z.infer<typeof ItemTagAssignmentSchema>

export const ItemSubstituteSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  substituteItemId: z.string(),
  note: z.string().nullable().optional(),
  createdAt: z.string(),
  substituteItem: z.object({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
    lifecycle: ItemLifecycleSchema.optional(),
    sellingPrice: z.coerce.number().nullable().optional(),
    baseUnit: z
      .object({ id: z.string(), code: z.string(), name: z.string() })
      .nullable()
      .optional(),
  }),
})
export type ItemSubstitute = z.infer<typeof ItemSubstituteSchema>

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

export const ItemGroupOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  subgroups: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
})

export const ItemSubgroupOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  groupId: z.string(),
})

export const ClassificationOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type ItemGroupOption = z.infer<typeof ItemGroupOptionSchema>
export type ItemSubgroupOption = z.infer<typeof ItemSubgroupOptionSchema>
export type ClassificationOption = z.infer<typeof ClassificationOptionSchema>

/**
 * Schema for the Create Item form.
 * tenantId is injected server-side and is NOT part of this form schema.
 */
export const CreateItemFormSchema = z.object({
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
  isExpiryTracked: z.boolean(),
  isBundle: z.boolean(),
  hasVariants: z.boolean(),
  revenueAccountId: z.string().optional(),
  cogsAccountId: z.string().optional(),
  inventoryAccountId: z.string().optional(),
  taxRateId: z.string().optional(),
  lengthCm: z.number().min(0).optional(),
  widthCm: z.number().min(0).optional(),
  heightCm: z.number().min(0).optional(),
  weightKg: z.number().min(0).optional(),
  warrantyPeriodDays: z.number().int().min(0).optional(),
  groupId: z.string().optional(),
  subgroupId: z.string().optional(),
  brandId: z.string().optional(),
  typeId: z.string().optional(),
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
  isExpiryTracked: z.boolean(),
  isBundle: z.boolean(),
  hasVariants: z.boolean(),
  revenueAccountId: z.string().optional(),
  cogsAccountId: z.string().optional(),
  inventoryAccountId: z.string().optional(),
  taxRateId: z.string().optional(),
  lengthCm: z.number().min(0).optional(),
  widthCm: z.number().min(0).optional(),
  heightCm: z.number().min(0).optional(),
  weightKg: z.number().min(0).optional(),
  warrantyPeriodDays: z.number().int().min(0).optional(),
  groupId: z.string().optional(),
  subgroupId: z.string().optional(),
  brandId: z.string().optional(),
  typeId: z.string().optional(),
})

export const UpdateLifecycleFormSchema = z.object({
  lifecycle: ItemLifecycleSchema,
})

export type CreateItemFormValues = z.infer<typeof CreateItemFormSchema>
export type UpdateItemFormValues = z.infer<typeof UpdateItemFormSchema>
export type UpdateLifecycleFormValues = z.infer<typeof UpdateLifecycleFormSchema>

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
  primaryCategory: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  baseUnit: z.object({ id: z.string(), name: z.string(), code: z.string() }).nullable().optional(),
  createdAt: z.string().optional(),
  taxRateId: z.string().nullable().optional(),
  group: classificationRefSchema,
  subgroup: classificationRefSchema,
  brand: classificationRefSchema,
  type: classificationRefSchema,
  isBundle: z.preprocess((v) => {
    if (v === true || v === 'true' || v === 1) return true
    if (v === false || v === 'false' || v === 0) return false
    return undefined
  }, z.boolean().optional()),
  hasVariants: z.preprocess((v) => {
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

export const ItemListResponseSchema = z.object({
  data: z.array(ItemSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

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
