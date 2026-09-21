import { z } from 'zod'

/**
 * Scenario 53 Part 6 — mirrors DailyCollectionService's return type. The shape
 * follows the client's own Daily Collection Report form: a running ledger,
 * DESC-type subtotals, a denomination block and the day's deposits.
 */
export const CollectionKindSchema = z.enum(['COD', 'DP', 'DC', 'MI', 'MI-PARTIAL'])
export type CollectionKind = z.infer<typeof CollectionKindSchema>

export const DailyCollectionRowSchema = z.object({
  date: z.string(),
  siNumber: z.string().nullable(),
  customerName: z.string(),
  kind: CollectionKindSchema,
  channel: z.enum(['OFFICE', 'FIELD', 'OTHERS']),
  crNumber: z.string().nullable(),
  cashInvoiceNumber: z.string().nullable(),
  ppd: z.number(),
  penalty: z.number(),
  tender: z.string(),
  amount: z.number(),
  isCash: z.boolean(),
})
export type DailyCollectionRow = z.infer<typeof DailyCollectionRowSchema>

/** One non-cash tender's take for the day. `tender` is the raw key
 * ('card::BDO'); `label` is what the form prints ('Card — BDO'), built by the
 * API so the screen, the print sheet and the workbook cannot disagree. */
export const NonCashTenderSchema = z.object({
  tender: z.string(),
  label: z.string(),
  amount: z.number(),
})
export type NonCashTender = z.infer<typeof NonCashTenderSchema>

export const DailyCollectionDepositSchema = z.object({
  bankName: z.string(),
  reference: z.string().nullable(),
  depositedAt: z.string(),
  amount: z.number(),
})
export type DailyCollectionDeposit = z.infer<typeof DailyCollectionDepositSchema>

/** The stored, hand-entered half of the form. */
export const DailyCollectionSheetSchema = z.object({
  checkedBy: z.string().nullable(),
  certifiedCorrectBy: z.string().nullable(),
  remarks: z.string().nullable(),
  denominationOverrideReason: z.string().nullable(),
  updatedAt: z.string(),
})
export type DailyCollectionSheet = z.infer<typeof DailyCollectionSheetSchema>

export const DailyCollectionReportSchema = z.object({
  /** Letterhead on the printed form — the enterprise's trading name. */
  companyName: z.string().default(''),
  branchId: z.string().nullable(),
  branchName: z.string(),
  date: z.string(),
  rows: z.array(DailyCollectionRowSchema),
  deposits: z.array(DailyCollectionDepositSchema),
  byKind: z.record(CollectionKindSchema, z.number()),
  /** Cash only — the ledger, the BALANCE column and the denomination count
   * all are, so they reconcile against the drawer. */
  totalCollection: z.number(),
  /** The day's non-cash take, per tender and the provider behind it — the
   * NON-CASH COLLECTIONS block printed below the cash ledger. */
  nonCash: z.array(NonCashTenderSchema).default([]),
  nonCashCollection: z.number(),
  /** Cash plus non-cash: everything the branch took that day. */
  grandTotalCollection: z.number().default(0),
  /** Sessions still open that took part of their shift on this date. Their
   * collections are already on the form; their drawer count is not, so the
   * count cannot be reconciled until they close. */
  openSessionCount: z.number().default(0),
  /** Opening float across the day's sessions — in the drawer when the
   * denominations are counted, but not a collection. */
  openingFloat: z.number().default(0),
  /** Float plus cash collected: what the denomination count must come to. */
  cashOnHand: z.number().default(0),
  totalDeposited: z.number(),
  balance: z.number(),
  /** What the form prints: the branch's corrected count when it has saved
   * one, the sessions' own closing counts otherwise. */
  denominations: z.record(z.string(), z.number()),
  denominationTotal: z.number(),
  /** The sessions' own counts, kept readable even when overridden — an edit
   * to a signed cash count has to stay visible, and the screen needs these to
   * offer "restore the counted figures". */
  countedDenominations: z.record(z.string(), z.number()).default({}),
  countedDenominationTotal: z.number().default(0),
  /** The handwritten half of the form, null until a branch saves one. */
  sheet: DailyCollectionSheetSchema.nullable().default(null),
  /** False for the "All branches" roll-up, which no one signs and nobody can
   * save a form against. */
  editable: z.boolean().default(false),
  /** True when the API deliberately left the figures out: a branch that has
   * not submitted its form, read by someone who is not that branch. The day's
   * collections are the branch's to declare, so until the cashier files there
   * is nothing here to read — the screen says so rather than drawing an empty
   * form. */
  withheld: z.boolean().default(false),
})
export type DailyCollectionReport = z.infer<typeof DailyCollectionReportSchema>

/**
 * Scenario 53 Part 6 — the owner's roll-up: every branch's day on one row.
 * Mirrors DailyCollectionService.buildRollup().
 */
export const DailyCollectionBranchStatusSchema = z.enum([
  'NO_TRADE',
  'OPEN',
  'BALANCED',
  'OVER',
  'SHORT',
])
export type DailyCollectionBranchStatus = z.infer<typeof DailyCollectionBranchStatusSchema>

export const DailyCollectionBranchSummarySchema = z.object({
  branchId: z.string(),
  branchName: z.string(),
  /** Cash ledger lines — a card-only day reports 0 and still has a grand
   * total, which is why both are on the row. */
  entryCount: z.number(),
  /** Null on a branch that has not filed, read by someone who is not that
   * branch — withheld by the API, not merely undrawn by the screen. */
  totalCollection: z.number().nullable(),
  nonCashCollection: z.number().nullable(),
  grandTotalCollection: z.number().nullable(),
  /** The drawer less the opening float. */
  cashCounted: z.number().nullable(),
  variance: z.number().nullable(),
  filed: z.boolean(),
  /** When the branch filed, null until it has. */
  filedAt: z.string().nullable().default(null),
  openSessionCount: z.number(),
  status: DailyCollectionBranchStatusSchema,
})
export type DailyCollectionBranchSummary = z.infer<typeof DailyCollectionBranchSummarySchema>

export const DailyCollectionRollupSchema = z.object({
  date: z.string(),
  branches: z.array(DailyCollectionBranchSummarySchema),
  totals: z.object({
    branchCount: z.number(),
    tradingCount: z.number(),
    filedCount: z.number(),
    entryCount: z.number(),
    totalCollection: z.number(),
    nonCashCollection: z.number(),
    grandTotalCollection: z.number(),
    cashCounted: z.number(),
    /** Summed over the branches this caller may read, which on the network
     * view means the filed ones only. */
    variance: z.number(),
  }),
})
export type DailyCollectionRollup = z.infer<typeof DailyCollectionRollupSchema>

/** The client form's own column order, kept beside the schema so the screen
 * and the exported workbook stay in step. */
export const LEDGER_HEADERS = [
  'Date',
  'SI#',
  'Customer',
  'Desc',
  'Office',
  'Field',
  'Others',
  'Cash Invoice',
  'PPD',
  'Pen',
  'Amount/Debit',
  'Credit',
  'Balance',
] as const

/** DESC subtotal order, as the client prints it. */
export const COLLECTION_KINDS: CollectionKind[] = ['COD', 'DP', 'DC', 'MI', 'MI-PARTIAL']

/**
 * What the screen sends when a branch saves its form. The whole document goes
 * at once — an omitted field is a cleared field, which is why this is a PUT.
 *
 * A corrected denomination count must say why: it is the only field here that
 * contradicts something the system already recorded (the closing count the
 * cashier declared, which the session's cash-variance journal entry was posted
 * against). The correction never rewrites that count — it is stored beside it.
 */
export const SaveDailyCollectionSheetSchema = z
  .object({
    date: z.string().min(1, 'A business date is required'),
    branchId: z.string().uuid().optional(),
    checkedBy: z.string().max(150).nullable(),
    certifiedCorrectBy: z.string().max(150).nullable(),
    remarks: z.string().max(1000).nullable(),
    denominationOverride: z.record(z.string(), z.number().nonnegative()).nullable(),
    denominationOverrideReason: z.string().max(500).nullable(),
  })
  .refine((v) => !v.denominationOverride || Boolean(v.denominationOverrideReason?.trim()), {
    message: 'Correcting the denomination count requires a reason',
    path: ['denominationOverrideReason'],
  })
export type SaveDailyCollectionSheetInput = z.infer<typeof SaveDailyCollectionSheetSchema>
