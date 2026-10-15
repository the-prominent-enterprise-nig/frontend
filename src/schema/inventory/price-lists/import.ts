import { z } from 'zod'
import { PriceListStatusEnum } from './index'

export const PriceListImportRowStatusEnum = z.enum([
  'create',
  'update',
  'other_price_use',
  'no_list',
  'not_in_catalog',
  'ambiguous',
  'duplicate',
  'error',
])
export type PriceListImportRowStatus = z.infer<typeof PriceListImportRowStatusEnum>

export const PriceListImportRowSchema = z.object({
  row: z.number(),
  brand: z.string(),
  model: z.string(),
  status: PriceListImportRowStatusEnum,
  message: z.string().optional(),
  // Where an importable row goes.
  priceUse: z.string().optional(),
  listName: z.string().optional(),
  itemId: z.string().optional(),
  itemSku: z.string().optional(),
  itemName: z.string().optional(),
  matchedBy: z.enum(['model', 'sku']).optional(),
  price: z.number().optional(),
  currentPrice: z.number().nullable().optional(),
  warning: z.string().optional(),
  // The row's cells under the template's own column names — only sent for
  // rows that won't be imported, so they can be exported, fixed and re-sent.
  record: z.record(z.string(), z.string()).optional(),
})
export type PriceListImportRow = z.infer<typeof PriceListImportRowSchema>

export const PriceListImportTotalsSchema = z.object({
  toCreate: z.number(),
  toUpdate: z.number(),
  otherPriceUse: z.number(),
  noList: z.number(),
  notInCatalog: z.number(),
  ambiguous: z.number(),
  duplicates: z.number(),
  errors: z.number(),
  warnings: z.number(),
})
export type PriceListImportTotals = z.infer<typeof PriceListImportTotalsSchema>

export const PriceListImportTargetSchema = z.object({
  priceUse: z.string(),
  listId: z.string(),
  listName: z.string(),
  listStatus: PriceListStatusEnum,
  listStatusAfter: PriceListStatusEnum,
  candidateLists: z.number(),
  toCreate: z.number(),
  toUpdate: z.number(),
  blockedReason: z.string().nullable(),
  applied: z.object({ created: z.number(), updated: z.number() }).nullable(),
})
export type PriceListImportTarget = z.infer<typeof PriceListImportTargetSchema>

export const PriceListImportResultSchema = z.object({
  dryRun: z.boolean(),
  fileRows: z.number(),
  skippedBlankRows: z.number(),
  totals: PriceListImportTotalsSchema,
  targets: z.array(PriceListImportTargetSchema),
  blockedReason: z.string().nullable(),
  applied: z.object({ created: z.number(), updated: z.number() }).nullable(),
  rows: z.array(PriceListImportRowSchema),
})
export type PriceListImportResult = z.infer<typeof PriceListImportResultSchema>
