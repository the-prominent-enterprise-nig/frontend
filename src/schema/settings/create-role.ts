import { z } from 'zod'

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').trim(),
  permissionIds: z.array(z.string().uuid('Each permission ID must be a valid UUID')).optional(),
})

export type CreateRoleInput = z.infer<typeof createRoleSchema>
