import { z } from 'zod'

export const CreateSalesQuotaSchema = z.object({
  branchId: z.string().optional(),
  grain: z.enum(['monthly', 'quarterly', 'annual']),
  fiscalYear: z.number().int().min(2020),
  targetAmount: z.number().positive('Target must be greater than 0'),
  notes: z.string().max(500).optional(),
})

export const CreateSalesQuotaServerSchema = CreateSalesQuotaSchema.extend({
  fiscalYear: z.coerce.number().int().min(2020),
  targetAmount: z.coerce.number().positive('Target must be greater than 0'),
})

export const UpdateSalesQuotaSchema = z.object({
  targetAmount: z.number().positive('Target must be greater than 0').optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(500).optional(),
})

const QuotaBranchSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const SalesQuotaSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  branchId: z.string().nullable().optional(),
  branch: QuotaBranchSchema.nullable().optional(),
  grain: z.enum(['monthly', 'quarterly', 'annual']),
  fiscalYear: z.number(),
  targetAmount: z.coerce.number(),
  isActive: z.boolean(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const SalesQuotaUsageSchema = z.object({
  quota: SalesQuotaSchema.nullable(),
  currentActual: z.number(),
  remaining: z.number().nullable(),
  usedPct: z.number(),
})

export type CreateSalesQuotaValues = z.infer<typeof CreateSalesQuotaSchema>
export type UpdateSalesQuotaValues = z.infer<typeof UpdateSalesQuotaSchema>
export type SalesQuota = z.infer<typeof SalesQuotaSchema>
export type SalesQuotaUsage = z.infer<typeof SalesQuotaUsageSchema>
