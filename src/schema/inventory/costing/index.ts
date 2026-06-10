import { z } from 'zod'

// ─── Costing method enum (lowercase, matches Prisma/backend) ─────────────────

export const CostingMethodSchema = z.enum(['fifo', 'lifo', 'weighted_average'])
export type CostingMethod = z.infer<typeof CostingMethodSchema>

export const COSTING_METHOD_LABELS: Record<CostingMethod, string> = {
  fifo: 'First-In First-Out (FIFO)',
  lifo: 'Last-In First-Out (LIFO)',
  weighted_average: 'Weighted Average Cost',
}

export const COSTING_METHOD_DESCRIPTIONS: Record<CostingMethod, string> = {
  fifo: 'Oldest stock is sold first. COGS reflects earlier purchase prices.',
  lifo: 'Newest stock is sold first. Reduces taxable income when costs are rising.',
  weighted_average:
    'Average cost per unit recalculated after each receipt. Smooths price fluctuations.',
}

export const COSTING_METHODS: CostingMethod[] = ['fifo', 'lifo', 'weighted_average']

// ─── Global config ────────────────────────────────────────────────────────────

export const CostingConfigSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  defaultCostingMethod: CostingMethodSchema,
  allowPerItemOverride: z.boolean(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
})
export type CostingConfig = z.infer<typeof CostingConfigSchema>

export const UpsertCostingConfigFormSchema = z.object({
  defaultCostingMethod: CostingMethodSchema,
  allowPerItemOverride: z.boolean().default(true),
})
export type UpsertCostingConfigFormValues = z.infer<typeof UpsertCostingConfigFormSchema>

// ─── Per-item override ────────────────────────────────────────────────────────

export const UpdateItemCostingMethodFormSchema = z.object({
  newMethod: CostingMethodSchema,
  revaluationNote: z.string().optional(),
})
export type UpdateItemCostingMethodFormValues = z.infer<typeof UpdateItemCostingMethodFormSchema>

// ─── Issue stock ──────────────────────────────────────────────────────────────

export const IssueStockFormSchema = z.object({
  itemId: z.string().min(1, 'Item is required'),
  warehouseId: z.string().min(1, 'Warehouse is required'),
  quantity: z.number().positive('Quantity must be positive'),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
})
export type IssueStockFormValues = z.infer<typeof IssueStockFormSchema>

export const IssueStockResultSchema = z.object({
  ledgerId: z.string(),
  costingMethod: CostingMethodSchema,
  quantityIssued: z.number(),
  unitCost: z.number(),
  cogsAmount: z.number(),
})
export type IssueStockResult = z.infer<typeof IssueStockResultSchema>

// ─── COGS preview ─────────────────────────────────────────────────────────────

export const CogsPreviewSchema = z.object({
  cogsAmount: z.number(),
  unitCost: z.number(),
  costingMethod: CostingMethodSchema,
  quantity: z.number(),
  layers: z
    .array(
      z.object({
        layerId: z.string(),
        qty: z.number(),
        unitCost: z.number(),
      })
    )
    .optional(),
})
export type CogsPreview = z.infer<typeof CogsPreviewSchema>

// ─── Stock valuation ──────────────────────────────────────────────────────────

export const ValuationItemSchema = z.object({
  itemId: z.string(),
  sku: z.string(),
  name: z.string(),
  costingMethod: CostingMethodSchema,
  warehouseId: z.string(),
  warehouseCode: z.string(),
  warehouseName: z.string(),
  onHandQty: z.number(),
  totalCostValue: z.number(),
  avgUnitCost: z.number(),
})
export type ValuationItem = z.infer<typeof ValuationItemSchema>

export const ValuationResponseSchema = z.object({
  items: z.array(ValuationItemSchema),
  grandTotal: z.number(),
  note: z.string().optional(),
})
export type ValuationResponse = z.infer<typeof ValuationResponseSchema>

// ─── Revaluation ─────────────────────────────────────────────────────────────

export const CreateRevaluationFormSchema = z.object({
  newMethod: CostingMethodSchema,
  revaluationNote: z.string().min(1, 'Revaluation note is required'),
})
export type CreateRevaluationFormValues = z.infer<typeof CreateRevaluationFormSchema>
