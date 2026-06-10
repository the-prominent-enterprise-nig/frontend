import { z } from 'zod'
import { InteractionTypeEnum } from './types'

export const createInteractionSchema = z
  .object({
    tenantId: z.string().min(1),
    customerId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    interactionType: InteractionTypeEnum,
    summary: z.string().min(1, 'Summary is required').max(1000),
    outcome: z.string().max(1000).optional().or(z.literal('')),
    loggedBy: z.string().min(1),
    occurredAt: z.string().min(1),
  })
  .refine((d) => Boolean(d.customerId || d.leadId), {
    message: 'Either customerId or leadId is required',
    path: ['customerId'],
  })

export type CreateInteractionInput = z.infer<typeof createInteractionSchema>
