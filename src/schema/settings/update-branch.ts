import { z } from 'zod'
import { BRANCH_TYPES } from './create-branch'

export const updateBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(150).trim().optional(),
  // Also the suffix on the branch's document numbers — new documents carry
  // the new code. Letters, digits and hyphens; unique per tenant.
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Branch code is required')
    .max(20, 'Branch code is at most 20 characters')
    .regex(/^[A-Z0-9-]+$/, 'Branch code may only contain letters, digits and hyphens')
    .optional(),
  type: z.enum(BRANCH_TYPES, { message: 'Branch type is required' }).optional(),
  address: z.string().max(255).trim().optional(),
  city: z.string().max(100).trim().optional(),
})

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>
