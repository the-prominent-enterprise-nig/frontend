import { z } from 'zod'

export const BundleComponentFormSchema = z.object({
  componentItemId: z.string().min(1, 'Component item is required'),
  quantityPerBundle: z
    .number({ message: 'Quantity must be a number' })
    .positive('Quantity must be greater than 0'),
})

const CreateBundleFormBaseSchema = z.object({
  name: z.string().min(1, 'Bundle name is required').max(120),
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(60)
    .regex(/^[A-Za-z0-9\-_]+$/, 'SKU may only contain letters, numbers, hyphens, and underscores'),
  baseUnitId: z.string().min(1, 'Unit of measure is required'),
  primaryCategoryId: z.string().min(1, 'Category is required'),
  sellingPrice: z.number().min(0).optional(),
  description: z.string().max(500).optional(),
  // A serial-tracked bundle is sold and registered as one physical unit (e.g.
  // a "Furniture Set") — its own serial, not per-component serials.
  isSerialTracked: z.boolean().optional(),
  components: z
    .array(BundleComponentFormSchema)
    .min(1, 'A bundle must include at least one component item'),
})

export const CreateBundleFormSchema = CreateBundleFormBaseSchema.extend({
  costPrice: z
    .number({ message: 'Cost price must be a number' })
    .min(0, 'Cost price must be 0 or greater'),
})

// Scenario 05 followup — for a caller without inventory:cost:view, the Cost
// Price field is hidden entirely rather than blocking bundle creation
// (costPrice is optional at the backend DTO level, same as Item Master; a
// cost-view holder can set it later via edit).
export const CreateBundleFormSchemaNoCost = CreateBundleFormBaseSchema.extend({
  costPrice: z.number().min(0, 'Cost price must be 0 or greater').optional(),
})

// Derived from the NoCost variant (costPrice optional) rather than
// CreateBundleFormSchema — CreateBundleModal resolves against whichever
// schema matches the caller's cost-view, and both output shapes must
// assign into this one shared value type.
export type CreateBundleFormValues = z.infer<typeof CreateBundleFormSchemaNoCost>
export type BundleComponentFormValues = z.infer<typeof BundleComponentFormSchema>

const BundleComponentSummarySchema = z.object({
  id: z.string().optional(),
  componentItemId: z.string().optional(),
  componentItem: z
    .object({ id: z.string(), name: z.string(), sku: z.string() })
    .optional()
    .nullable(),
  quantityPerBundle: z.coerce.number(),
  availableStock: z.coerce.number().optional().nullable(),
})

export const BundleComponentsResponseSchema = z.object({
  bundleItemId: z.string().optional(),
  bundleAvailableQty: z.coerce.number().optional().nullable(),
  components: z.array(BundleComponentSummarySchema).default([]),
})

export type BundleComponentSummary = z.infer<typeof BundleComponentSummarySchema>
export type BundleComponentsResponse = z.infer<typeof BundleComponentsResponseSchema>
