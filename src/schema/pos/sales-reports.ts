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
  /** Manila business day, 'YYYY-MM-DD' — what Date and Month show. */
  day: z.string(),
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

/** Scenario 85 Part 3 — the Dashboard's model × month / brand × month view. */
const MonthCellSchema = z.object({ units: z.number(), gross: z.number() })

export const SalesByMonthSchema = z.object({
  dimension: z.enum(['model', 'brand']),
  /** 'YYYY-MM', oldest first. */
  months: z.array(z.string()),
  rows: z.array(
    z.object({
      key: z.string(),
      brand: z.string(),
      perMonth: z.array(MonthCellSchema),
      totalUnits: z.number(),
      totalGross: z.number(),
    })
  ),
  rowCount: z.number(),
  grandTotal: z.object({
    perMonth: z.array(MonthCellSchema),
    totalUnits: z.number(),
    totalGross: z.number(),
  }),
})

export type SalesByMonth = z.infer<typeof SalesByMonthSchema>
export type SalesByMonthRow = SalesByMonth['rows'][number]

/** Scenario 85 Part 5 — the Branch Scorecard. Money is gross at LCP. */
export const PaceStatusSchema = z.enum(['met', 'ahead', 'behind', 'far_behind'])

const ScorecardFiguresSchema = z.object({
  total: z.number(),
  office: z.number(),
  officeShare: z.number(),
  quota: z.number().nullable(),
  achRate: z.number().nullable(),
  bts: z.number().nullable(),
  status: PaceStatusSchema.nullable(),
})

export const ScorecardSchema = z.object({
  period: z.object({
    from: z.string(),
    asOf: z.string(),
    daysInMonth: z.number(),
    daysElapsed: z.number(),
    pace: z.number(),
  }),
  rows: z.array(
    ScorecardFiguresSchema.extend({
      key: z.string(),
      kind: z.enum(['branch', 'line']),
      name: z.string(),
      daily: z.array(z.object({ day: z.string(), total: z.number(), office: z.number() })),
    })
  ),
  totalBranches: ScorecardFiguresSchema,
  grandTotal: ScorecardFiguresSchema,
  aheadOrMet: z.number(),
  branchCount: z.number(),
})

export type PaceStatus = z.infer<typeof PaceStatusSchema>
export type ScorecardFigures = z.infer<typeof ScorecardFiguresSchema>
export type Scorecard = z.infer<typeof ScorecardSchema>
export type ScorecardRow = Scorecard['rows'][number]

/** Scenario 85 Part 6 — Daily Sales Monitoring: the scorecard read day by day,
 * plus last-year and running-balance totals (system data only). */
export const DailyMonitoringSchema = z.object({
  scorecard: ScorecardSchema,
  comparisons: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      from: z.string(),
      to: z.string(),
      total: z.number(),
      hasData: z.boolean(),
    })
  ),
})

export type DailyMonitoring = z.infer<typeof DailyMonitoringSchema>
