import { z } from 'zod'
import { AgentStatusEnum } from './types'

export const createAgentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  phone: z.string().max(50).optional().or(z.literal('')),
  email: z.string().email('Invalid email').max(255).optional().or(z.literal('')),
  status: AgentStatusEnum.optional(),
  /** Flat commission rate as a fraction, e.g. 0.05 = 5%. Null/omitted = no commission. */
  commissionRate: z.number().min(0).max(1).nullable().optional(),
})
export type CreateAgentInput = z.infer<typeof createAgentSchema>

export const updateAgentSchema = createAgentSchema.partial()
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>
