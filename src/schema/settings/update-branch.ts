import { z } from 'zod'
import { BRANCH_TYPES } from './create-branch'

export const updateBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(150).trim().optional(),
  type: z.enum(BRANCH_TYPES, { message: 'Branch type is required' }).optional(),
  address: z.string().max(255).trim().optional(),
})

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>
