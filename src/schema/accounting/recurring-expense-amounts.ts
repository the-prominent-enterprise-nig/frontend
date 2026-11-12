import { z } from 'zod'

// GET /expenses/recurring-types/:id/amounts — what was recorded under one entry of
// the Recurring Expenses list (Docket #55), read-only. Only recorded expenses come
// back, and each row is the expense line filed on the entry's account, so a mixed
// entry shows just its own share. A Fuel / Repair line also names its plate.
export const RecurringAmountSchema = z.object({
  lineId: z.string(),
  expenseId: z.string(),
  expenseNumber: z.string(),
  voucherNumber: z.string().nullable().optional(),
  expenseDate: z.string(),
  payee: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  plateNo: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  liters: z.number().nullable().optional(),
  repairServiceType: z.string().nullable().optional(),
  serviceDetail: z.string().nullable().optional(),
  amount: z.number(),
})
export type RecurringAmount = z.infer<typeof RecurringAmountSchema>

export const RecurringAmountsResponseSchema = z.object({
  entry: z.object({
    id: z.string(),
    name: z.string(),
    // null: the entry names no account ("picked each time"), so nothing is read.
    account: z
      .object({
        id: z.string(),
        number: z.string(),
        name: z.string(),
        expenseKind: z.string().nullable().optional(),
      })
      .nullable(),
  }),
  data: z.array(RecurringAmountSchema),
  meta: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    lastPage: z.number(),
  }),
  totals: z.object({ amount: z.number(), count: z.number() }),
})
export type RecurringAmountsResponse = z.infer<typeof RecurringAmountsResponseSchema>
