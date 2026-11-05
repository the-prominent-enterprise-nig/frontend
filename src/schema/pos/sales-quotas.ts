import { z } from 'zod'

/** Scenario 85 Part 4 — monthly sales quotas (GET/PUT /pos/sales-quotas). */

export const QuotaTargetSchema = z.object({
  /** 'branch:<id>' or 'line:ac_unit_services'. */
  key: z.string(),
  kind: z.enum(['branch', 'line']),
  name: z.string(),
  region: z.string().nullable(),
})

export const SalesQuotaYearSchema = z.object({
  year: z.number(),
  targets: z.array(QuotaTargetSchema),
  /** targetKey → 12 monthly amounts, January first; null where none is set. */
  amounts: z.record(z.string(), z.array(z.number().nullable())),
})

export const SaveSalesQuotasSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  entries: z
    .array(
      z.object({
        target: z.string().min(1),
        month: z.number().int().min(1).max(12),
        amount: z.number().min(0).max(9_999_999_999).nullable(),
      })
    )
    .max(2000),
})

/** The grid form: targetKey → 12 cells, each the plain number typed ('' = none). */
export const QuotaGridFormSchema = z.object({
  cells: z.record(
    z.string(),
    z.array(
      z.string().refine((v) => v === '' || (Number.isFinite(Number(v)) && Number(v) >= 0), {
        message: 'Enter an amount, or leave it blank',
      })
    )
  ),
})

export type QuotaTarget = z.infer<typeof QuotaTargetSchema>
export type SalesQuotaYear = z.infer<typeof SalesQuotaYearSchema>
export type SaveSalesQuotasInput = z.infer<typeof SaveSalesQuotasSchema>
export type QuotaGridForm = z.infer<typeof QuotaGridFormSchema>
