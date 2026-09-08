import { z } from 'zod'

/** Scenario 47 — shapes returned by /pos/reports/sales-by-{branch,brand}. */

export const SalesDetailRowSchema = z.object({
  date: z.string(),
  transactionNumber: z.string(),
  branchId: z.string().nullable(),
  branchName: z.string(),
  brandName: z.string(),
  categoryName: z.string(),
  modelNumber: z.string(),
  serialNumbers: z.string(),
  sku: z.string(),
  itemName: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  gross: z.number(),
  discount: z.number(),
  net: z.number(),
  vat: z.number(),
  unitCost: z.number(),
  totalCost: z.number(),
  margin: z.number(),
  invoiceType: z.string(),
  isRefund: z.boolean(),
})

export const SalesTotalsSchema = z.object({
  units: z.number(),
  gross: z.number(),
  discount: z.number(),
  net: z.number(),
  vat: z.number(),
  cost: z.number(),
  margin: z.number(),
  refunds: z.number(),
  transactionCount: z.number(),
})

export const SalesSummaryRowSchema = SalesTotalsSchema.extend({
  keys: z.array(z.string()),
})

export const SalesReportResponseSchema = z.object({
  summary: z.array(SalesSummaryRowSchema),
  rows: z.array(SalesDetailRowSchema),
  meta: z.object({
    groupBy: z.enum(['branch', 'brand']),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    rowCount: z.number(),
    deliveryFees: z.number(),
    totals: SalesTotalsSchema,
  }),
})

export type SalesDetailRow = z.infer<typeof SalesDetailRowSchema>
export type SalesSummaryRow = z.infer<typeof SalesSummaryRowSchema>
export type SalesReportResponse = z.infer<typeof SalesReportResponseSchema>

/** Summary key columns follow the grouping order, matching the backend. */
export const SUMMARY_KEY_HEADERS: Record<'branch' | 'brand', string[]> = {
  branch: ['Branch', 'Brand', 'Category'],
  brand: ['Brand', 'Category', 'Branch'],
}
