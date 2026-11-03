import { z } from 'zod'

// Mirrors the backend's VehicleCategory enum exactly (backend/prisma/schema.prisma)
export const VehicleCategorySchema = z.enum(['delivery', 'service', 'collector'])
export type VehicleCategory = z.infer<typeof VehicleCategorySchema>

const BranchRefSchema = z.object({ id: z.string(), name: z.string() })

// A vehicle on the fleet roster — plate, type, category. It carries no driver:
// drivers are their own list (schema/inventory/drivers) and are not tied to a
// plate. `tag` is the roster's "Vehicle Type" (TRUCK, TOP DOWN, …).
export const VehicleSummarySchema = z.object({
  id: z.string(),
  plateNo: z.string(),
  category: VehicleCategorySchema,
  tag: z.string().nullable().optional(),
})
export type VehicleSummary = z.infer<typeof VehicleSummarySchema>

// GET /inventory/vehicles — the dispatch plate picker's search.
export const VehicleSearchResponseSchema = z.array(VehicleSummarySchema)

export const VehicleListItemSchema = VehicleSummarySchema.extend({
  branchId: z.string().nullable().optional(),
  branch: BranchRefSchema.nullable().optional(),
})
export type VehicleListItem = z.infer<typeof VehicleListItemSchema>

const PageMetaSchema = z.object({
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  lastPage: z.number(),
})

// GET /inventory/vehicles/list
export const VehicleListResponseSchema = z.object({
  data: z.array(VehicleListItemSchema),
  meta: PageMetaSchema,
})
export type VehicleListResponse = z.infer<typeof VehicleListResponseSchema>

export const VehicleFormSchema = z.object({
  plateNo: z.string().trim().min(1, 'Plate number is required').max(50),
  category: VehicleCategorySchema,
  tag: z.string().trim().max(50).optional(),
  branchId: z.string().optional(),
})
export type VehicleFormValues = z.infer<typeof VehicleFormSchema>

// GET /expenses/vehicles/:vehicleId/expenses — the Fuel / Vehicle Repair lines
// recorded against one plate, read-only. Only recorded expenses come back.
export const VehicleExpenseKindSchema = z.enum(['FUEL', 'VEHICLE_REPAIR'])
export type VehicleExpenseKind = z.infer<typeof VehicleExpenseKindSchema>

export const VehicleExpenseRowSchema = z.object({
  lineId: z.string(),
  expenseId: z.string(),
  expenseNumber: z.string(),
  voucherNumber: z.string().nullable().optional(),
  expenseDate: z.string(),
  kind: VehicleExpenseKindSchema,
  account: z.string(),
  description: z.string().nullable().optional(),
  liters: z.number().nullable().optional(),
  repairServiceType: z.string().nullable().optional(),
  serviceDetail: z.string().nullable().optional(),
  amount: z.number(),
})
export type VehicleExpenseRow = z.infer<typeof VehicleExpenseRowSchema>

export const VehicleExpensesResponseSchema = z.object({
  vehicle: z.object({
    id: z.string(),
    plateNo: z.string(),
    tag: z.string().nullable().optional(),
    category: VehicleCategorySchema,
    branch: BranchRefSchema.nullable().optional(),
  }),
  data: z.array(VehicleExpenseRowSchema),
  meta: PageMetaSchema,
  totals: z.object({ amount: z.number(), liters: z.number(), count: z.number() }),
})
export type VehicleExpensesResponse = z.infer<typeof VehicleExpensesResponseSchema>
