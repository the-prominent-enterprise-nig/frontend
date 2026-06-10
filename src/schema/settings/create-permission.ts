import { z } from 'zod'

export const createPermissionSchema = z.object({
  module: z.string().min(1, 'Module is required').trim(),
  resource: z.string().min(1, 'Resource is required').trim(),
  action: z.string().min(1, 'Action is required').trim(),
  description: z.string().trim().optional(),
})

export type CreatePermissionInput = z.infer<typeof createPermissionSchema>
