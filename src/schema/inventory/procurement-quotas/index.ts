import { z } from 'zod'

export const CreateProcurementQuotaSchema = z.object({
  branchId: z.string().optional(),
  grain: z.enum(['monthly', 'quarterly', 'annual']),
  fiscalYear: z.number().int().min(2020),
  limitAmount: z.number().positive('Limit must be greater than 0'),
  notes: z.string().max(500).optional(),
})

export const CreateProcurementQuotaServerSchema = CreateProcurementQuotaSchema.extend({
  fiscalYear: z.coerce.number().int().min(2020),
  limitAmount: z.coerce.number().positive('Limit must be greater than 0'),
})

export const UpdateProcurementQuotaSchema = z.object({
  limitAmount: z.number().positive('Limit must be greater than 0').optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(500).optional(),
})

const QuotaBranchSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const ProcurementQuotaSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  branchId: z.string().nullable().optional(),
  branch: QuotaBranchSchema.nullable().optional(),
  grain: z.enum(['monthly', 'quarterly', 'annual']),
  fiscalYear: z.number(),
  limitAmount: z.coerce.number(),
  isActive: z.boolean(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const QuotaUsageSchema = z.object({
  quota: ProcurementQuotaSchema.nullable(),
  currentSpend: z.number(),
  remaining: z.number().nullable(),
  usedPct: z.number(),
})

export type CreateProcurementQuotaValues = z.infer<typeof CreateProcurementQuotaSchema>
export type UpdateProcurementQuotaValues = z.infer<typeof UpdateProcurementQuotaSchema>
export type ProcurementQuota = z.infer<typeof ProcurementQuotaSchema>
export type QuotaUsage = z.infer<typeof QuotaUsageSchema>
