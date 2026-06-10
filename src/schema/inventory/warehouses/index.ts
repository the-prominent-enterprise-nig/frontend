import { z } from 'zod'

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

export const WarehouseSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  address: z.string().nullable().optional(),
  status: WarehouseStatusSchema.optional(),
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
