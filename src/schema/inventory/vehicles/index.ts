import { z } from 'zod'

// Mirrors the backend's VehicleCategory enum exactly (backend/prisma/schema.prisma)
export const VehicleCategorySchema = z.enum(['delivery', 'service', 'collector'])
export type VehicleCategory = z.infer<typeof VehicleCategorySchema>

export const VehicleSummarySchema = z.object({
  id: z.string(),
  plateNo: z.string(),
  driverName: z.string().nullable().optional(),
  contactNumber: z.string().nullable().optional(),
  category: VehicleCategorySchema,
  tag: z.string().nullable().optional(),
})
export type VehicleSummary = z.infer<typeof VehicleSummarySchema>

export const VehicleListResponseSchema = z.array(VehicleSummarySchema)

export const DriverListItemSchema = VehicleSummarySchema.extend({
  branch: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
})
export type DriverListItem = z.infer<typeof DriverListItemSchema>

export const DriverListResponseSchema = z.object({
  data: z.array(DriverListItemSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
  }),
})
export type DriverListResponse = z.infer<typeof DriverListResponseSchema>

export const DriverFormSchema = z.object({
  driverName: z.string().trim().min(1, 'Driver name is required').max(150),
  plateNo: z.string().trim().min(1, 'Plate number is required').max(50),
  category: VehicleCategorySchema,
  contactNumber: z.string().trim().max(50).optional(),
  tag: z.string().trim().max(50).optional(),
  branchId: z.string().optional(),
})
export type DriverFormValues = z.infer<typeof DriverFormSchema>
