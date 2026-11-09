import { z } from 'zod'

// GET /expenses/electricity/payments — the payments recorded on Electricity /
// Light Expense (6-03-040), read-only. Only recorded expenses come back, and each
// row is the electricity line itself, so a mixed entry shows just its own share.
export const ElectricityPaymentSchema = z.object({
  lineId: z.string(),
  expenseId: z.string(),
  expenseNumber: z.string(),
  voucherNumber: z.string().nullable().optional(),
  expenseDate: z.string(),
  payee: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  amount: z.number(),
})
export type ElectricityPayment = z.infer<typeof ElectricityPaymentSchema>

export const ElectricityPaymentsResponseSchema = z.object({
  data: z.array(ElectricityPaymentSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
  }),
  totals: z.object({ amount: z.number(), count: z.number() }),
})
export type ElectricityPaymentsResponse = z.infer<typeof ElectricityPaymentsResponseSchema>
