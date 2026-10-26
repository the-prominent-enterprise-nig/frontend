import { z } from 'zod'

// A driver is a person on the fleet roster: name, contact number, branch. Not
// tied to a vehicle — which plate someone drives varies per trip.
export const DriverSchema = z.object({
  id: z.string(),
  name: z.string(),
  contactNumber: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  branch: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
})
export type Driver = z.infer<typeof DriverSchema>

export const DriverListResponseSchema = z.object({
  data: z.array(DriverSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
  }),
})
export type DriverListResponse = z.infer<typeof DriverListResponseSchema>

export const DriverFormSchema = z.object({
  name: z.string().trim().min(1, 'Driver name is required').max(150),
  contactNumber: z.string().trim().max(50).optional(),
  branchId: z.string().optional(),
})
export type DriverFormValues = z.infer<typeof DriverFormSchema>
