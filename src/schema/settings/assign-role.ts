import { z } from 'zod'

export const assignRoleSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
  roleId: z.string().uuid('Role ID must be a valid UUID'),
})

export type AssignRoleInput = z.infer<typeof assignRoleSchema>
