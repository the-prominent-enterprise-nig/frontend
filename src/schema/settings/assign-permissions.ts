import { z } from 'zod'

export const assignPermissionsSchema = z.object({
  roleId: z.string().uuid('Role ID must be a valid UUID'),
  permissionIds: z.array(z.string().uuid('Each permission ID must be a valid UUID')),
})

export type AssignPermissionsInput = z.infer<typeof assignPermissionsSchema>
