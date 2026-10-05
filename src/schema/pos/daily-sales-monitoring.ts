import { z } from 'zod'

/**
 * Scenario 61 Part 2 — mirrors DailySalesMonitoringService's return type: the
 * client's paper DAILY SALES & COLLECTION MONITORING sheet for one branch and
 * business day — sales only.
 */
export const SalesCategorySchema = z.enum([
  'APPLIANCES',
  'FURNITURE_3E',
  'FURNITURE_NON_3E',
  'SMALL_ITEMS',
  'IT_COMPUTER',
  'IT_CELLPHONE',
  'SPLIT_TYPE',
])
export type SalesCategory = z.infer<typeof SalesCategorySchema>

export const DailySalesMonitoringReportSchema = z.object({
  companyName: z.string().default(''),
  branchId: z.string().nullable(),
  branchName: z.string(),
  date: z.string(),
  sales: z.object({
    byCategory: z.record(SalesCategorySchema, z.number()),
    agentSales: z.number(),
    officeSales: z.number(),
    cashInvoice: z.number(),
    chargeInvoice: z.number(),
    totalSales: z.number(),
    transactionCount: z.number(),
    invoiceNumbers: z.array(z.string()),
  }),
  openSessionCount: z.number().default(0),
})
export type DailySalesMonitoringReport = z.infer<typeof DailySalesMonitoringReportSchema>
