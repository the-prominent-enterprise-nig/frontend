import { z } from 'zod'

export const BRANCH_TYPES = ['retail', 'warehouse', 'office', 'mixed'] as const

// Which regional warehouse (Panay / Negros) serves the branch. A
// 'warehouse'-type branch has none — it is the region's warehouse.
export const BRANCH_REGIONS = ['panay', 'negros'] as const

export const createBranchSchema = z.object({
  name: z.string().min(1, 'Branch name is required').max(150).trim(),
  type: z.enum(BRANCH_TYPES, { message: 'Branch type is required' }),
  address: z.string().max(255).trim().optional(),
  region: z.enum(BRANCH_REGIONS).optional(),
})

export type CreateBranchInput = z.infer<typeof createBranchSchema>
