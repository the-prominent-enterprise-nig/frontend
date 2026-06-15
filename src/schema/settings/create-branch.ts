import { z } from 'zod'

export const BRANCH_TYPES = ['retail', 'warehouse', 'office', 'mixed'] as const

export const createBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(150).trim(),
  type: z.enum(BRANCH_TYPES, { message: 'Branch type is required' }),
  address: z.string().max(255).trim().optional(),
})

export type CreateBranchInput = z.infer<typeof createBranchSchema>
