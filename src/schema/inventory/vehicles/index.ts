import { z } from 'zod'

// Mirrors the backend's VehicleCategory enum exactly (backend/prisma/schema.prisma)
export const VehicleCategorySchema = z.enum(['delivery', 'service', 'collector'])
export type VehicleCategory = z.infer<typeof VehicleCategorySchema>

export const VehicleSummarySchema = z.object({
  id: z.string(),
  plateNo: z.string(),
  driverName: z.string().nullable().optional(),
  category: VehicleCategorySchema,
  tag: z.string().nullable().optional(),
})
export type VehicleSummary = z.infer<typeof VehicleSummarySchema>

export const VehicleListResponseSchema = z.array(VehicleSummarySchema)
