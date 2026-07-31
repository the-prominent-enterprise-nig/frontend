import { z } from 'zod'
import { CollectorStatusEnum } from './types'

export const createCollectorSchema = z.object({
  stubNumber: z.string().min(1, 'Stub number is required').max(20),
  name: z.string().min(1, 'Name is required').max(255),
  branchId: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined)
    .optional(),
  userId: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined)
    .optional(),
  status: CollectorStatusEnum.optional(),
})

export type CreateCollectorInput = z.infer<typeof createCollectorSchema>

export const updateCollectorSchema = createCollectorSchema.partial()
export type UpdateCollectorInput = z.infer<typeof updateCollectorSchema>

export const createRemittanceSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  remittedAt: z.string().min(1, 'Remittance date is required'),
  cashierId: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined)
    .optional(),
  reference: z.string().max(100).optional().or(z.literal('')),
  collectionBatch: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export type CreateRemittanceInput = z.infer<typeof createRemittanceSchema>
