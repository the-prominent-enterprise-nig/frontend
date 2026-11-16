import { z } from 'zod'
import { BRANCH_TYPES } from './create-branch'

export const updateBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(150).trim().optional(),
  type: z.enum(BRANCH_TYPES, { message: 'Branch type is required' }).optional(),
  address: z.string().max(255).trim().optional(),
  city: z.string().max(100).trim().optional(),
  // Empty string clears it, so the series falls back to the branch code.
  seriesCode: z
    .string()
    .trim()
    .max(20, 'Series code is at most 20 characters')
    .regex(/^[A-Za-z0-9]*$/, 'Series code takes letters and digits only')
    .optional(),
})

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>
