import { z } from 'zod'

export const createUserSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  firstName: z.string().max(60).optional(),
  lastName: z.string().max(60).optional(),
  roleIds: z
    .array(z.string().uuid('Each role ID must be a valid UUID'))
    .min(1, 'At least one role is required'),
  employeeId: z.string().optional(),
  departmentId: z.string().uuid('Department ID must be a valid UUID').optional(),
  positionId: z.string().uuid('Position ID must be a valid UUID').optional(),
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
