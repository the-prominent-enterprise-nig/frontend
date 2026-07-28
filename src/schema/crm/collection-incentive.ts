import { z } from 'zod'
import { InstallmentAccountCategoryEnum } from './types'

export const createCollectionIncentiveSchema = z.object({
  collectorId: z.string().min(1, 'Collector is required'),
  branchId: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined)
    .optional(),
  installmentAccountId: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || undefined)
    .optional(),
  category: InstallmentAccountCategoryEnum,
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export type CreateCollectionIncentiveInput = z.infer<typeof createCollectionIncentiveSchema>

export const rejectCollectionIncentiveSchema = z.object({
  reason: z.string().max(500).optional().or(z.literal('')),
})

export type RejectCollectionIncentiveInput = z.infer<typeof rejectCollectionIncentiveSchema>
