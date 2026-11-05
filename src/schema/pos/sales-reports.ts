import { z } from 'zod'

/** Scenario 85 — shapes returned by /pos/reports/sales/*. */

const OptionSchema = z.object({ id: z.string(), name: z.string() })

export const SalesFilterOptionsSchema = z.object({
  regions: z.array(OptionSchema),
  branches: z.array(OptionSchema.extend({ region: z.string().nullable() })),
  types: z.array(OptionSchema),
  groups: z.array(OptionSchema),
  brands: z.array(OptionSchema),
  branchLocked: z.boolean(),
})

/** The four stat cards every tab shows. Money is gross sales at LCP. */
export const SalesSummarySchema = z.object({
  totalGross: z.number(),
  officeGross: z.number(),
  agentGross: z.number(),
  officeShare: z.number(),
  agentShare: z.number(),
  units: z.number(),
  lineCount: z.number(),
})

export type SalesFilterOptions = z.infer<typeof SalesFilterOptionsSchema>
export type SalesSummary = z.infer<typeof SalesSummarySchema>

/** The shared filter bar's values, as the backend takes them. */
export type SalesReportsParams = {
  startDate?: string
  endDate?: string
  regions?: string
  branchIds?: string
  itemTypeIds?: string
  groupIds?: string
  brandIds?: string
}

/** Scenario 85 Part 2 — one sold (or refunded) unit on the Sales Report tab.
 * Money is gross at LCP; quantity and LCP are negative on a refund. */
export const SalesLineSchema = z.object({
  date: z.string(),
  transactionId: z.string(),
  transactionNumber: z.string(),
  salesInvoiceNumber: z.string().nullable(),
  branchId: z.string().nullable(),
  branchName: z.string(),
  invoiceType: z.string(),
  classification: z.string(),
  customerFirstName: z.string(),
  customerLastName: z.string(),
  typeName: z.string(),
  groupName: z.string(),
  subgroupName: z.string(),
  brandName: z.string(),
  modelNumber: z.string(),
  serialNumbers: z.string(),
  quantity: z.number(),
  lcp: z.number(),
  unitCost: z.number(),
  priceUseName: z.string(),
  agentName: z.string(),
  commission: z.number(),
  isRefund: z.boolean(),
})

export const SalesLinesPageSchema = z.object({
  rows: z.array(SalesLineSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totals: SalesSummarySchema,
})

export type SalesLine = z.infer<typeof SalesLineSchema>
export type SalesLinesPage = z.infer<typeof SalesLinesPageSchema>
