import { z } from 'zod'

export const assignBranchSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
  branchId: z.string().uuid('Branch ID must be a valid UUID'),
})

export type AssignBranchInput = z.infer<typeof assignBranchSchema>
