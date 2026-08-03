import { z } from 'zod'
import { InteractionTypeEnum } from './types'

export const createInteractionSchema = z
  .object({
    tenantId: z.string().min(1),
    customerId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    installmentAccountId: z.string().uuid().optional(),
    collectorId: z.string().uuid().optional(),
    contactPhone: z.string().max(20).optional().or(z.literal('')),
    interactionType: InteractionTypeEnum,
    summary: z.string().min(1, 'Summary is required').max(1000),
    outcome: z.string().max(1000).optional().or(z.literal('')),
    loggedBy: z.string().min(1),
    occurredAt: z.string().min(1),
  })
  .refine((d) => Boolean(d.customerId || d.leadId || d.installmentAccountId), {
    message: 'Either customerId, leadId, or installmentAccountId is required',
    path: ['customerId'],
  })

export type CreateInteractionInput = z.infer<typeof createInteractionSchema>
