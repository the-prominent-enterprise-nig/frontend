import { z } from 'zod'

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Designation is required').trim(),
  description: z.string().max(255, 'Job Description must be 255 characters or fewer').optional(),
  permissionIds: z.array(z.string().uuid('Each permission ID must be a valid UUID')).optional(),
})

export type CreateRoleInput = z.infer<typeof createRoleSchema>
