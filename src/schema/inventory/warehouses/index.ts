import { z } from 'zod'
import { caravanLabel } from '@/src/libs/format/locationLabel'

export const WarehouseStatusSchema = z.enum(['active', 'inactive'])
export const LocationTypeSchema = z.enum(['shelf', 'bin', 'zone', 'dock'])

export const CreateWarehouseFormSchema = z.object({
  code: z
    .string()
    .min(1, 'Warehouse code is required')
    .max(20)
    .regex(/^[A-Za-z0-9\-_]+$/, 'Code may only contain letters, numbers, hyphens, and underscores'),
  name: z.string().min(1, 'Warehouse name is required').max(120),
  address: z.string().max(300).optional(),
  status: WarehouseStatusSchema,
})

export const UpdateWarehouseFormSchema = z.object({
  code: z
    .string()
    .min(1, 'Warehouse code is required')
    .max(20)
    .regex(/^[A-Za-z0-9\-_]+$/, 'Code may only contain letters, numbers, hyphens, and underscores'),
  name: z.string().min(1, 'Warehouse name is required').max(120),
  address: z.string().max(300).optional(),
  status: WarehouseStatusSchema,
})

export const CreateLocationFormSchema = z.object({
  code: z
    .string()
    .min(1, 'Location code is required')
    .max(20)
    .regex(/^[A-Za-z0-9\-_]+$/, 'Code may only contain letters, numbers, hyphens, and underscores'),
  name: z.string().max(120).optional(),
  locationType: LocationTypeSchema,
})

export type CreateWarehouseFormValues = z.infer<typeof CreateWarehouseFormSchema>
export type UpdateWarehouseFormValues = z.infer<typeof UpdateWarehouseFormSchema>
export type CreateLocationFormValues = z.infer<typeof CreateLocationFormSchema>

// Scenario 60 Part 2 — a warehouse's branch, with the caravan fields the
// backend sends alongside it (false/null for an ordinary branch). A caravan
// is a temporary Branch parked at a host branch for an event.
export const WarehouseBranchSchema = z.object({
  id: z.string(),
  name: z.string(),
  isTemporary: z.boolean().optional(),
  eventName: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  hostBranch: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  // A caravan's location — where it is physically set up. Null when none was given.
  addressLine1: z.string().nullable().optional(),
})
export type WarehouseBranch = z.infer<typeof WarehouseBranchSchema>

type LabelledWarehouse = { name: string; branch?: WarehouseBranch | null } | null | undefined

export function isCaravanBranch(branch: WarehouseBranch | null | undefined): boolean {
  return !!branch?.isTemporary
}

/** Ended once its end date is before today — mirrors the backend rule that
 * stops new stock going in (stock can still be transferred out). */
export function isCaravanEnded(branch: WarehouseBranch | null | undefined): boolean {
  if (!branch?.isTemporary || !branch.endDate) return false
  return branch.endDate.slice(0, 10) < new Date().toISOString().slice(0, 10)
}

/**
 * How a warehouse reads anywhere a location is named. Each branch has one
 * warehouse, so it shows as its branch; a caravan says so outright and names
 * its host, so no one mistakes event stock for a branch of its own.
 */
export function warehouseLabel(wh: LabelledWarehouse, fallback = '—'): string {
  const branch = wh?.branch
  if (branch?.isTemporary) return caravanLabel(branch)
  return branch?.name ?? wh?.name ?? fallback
}

export const WarehouseSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  address: z.string().nullable().optional(),
  status: WarehouseStatusSchema.optional(),
  branchId: z.string().nullable().optional(),
  // Scenario 27 — only set on the 2 real (standalone) warehouses; used to
  // default a branch's "Request from Warehouse" picker to its own region.
  region: z.enum(['panay', 'negros']).nullable().optional(),
  // Each branch has exactly one warehouse — pickers display this branch name
  // rather than the warehouse's own "{branch} Warehouse" name.
  branch: WarehouseBranchSchema.nullable().optional(),
  _count: z.object({ locations: z.number() }).optional(),
})

export const WarehouseListResponseSchema = z.object({
  data: z.array(WarehouseSummarySchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
})

export const LocationSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string().nullable().optional(),
  locationType: LocationTypeSchema.optional(),
  warehouseId: z.string().optional(),
  _count: z.object({ stockBalances: z.number() }).optional(),
})

export const LocationListResponseSchema = z.array(LocationSummarySchema)

export type WarehouseSummary = z.infer<typeof WarehouseSummarySchema>
export type WarehouseListResponse = z.infer<typeof WarehouseListResponseSchema>
export type LocationSummary = z.infer<typeof LocationSummarySchema>
