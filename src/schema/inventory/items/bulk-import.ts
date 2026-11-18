import { z } from 'zod'
import { PriceListImportResultSchema } from '../price-lists/import'

export const BulkImportCreatedRowSchema = z.object({
  row: z.number(),
  sku: z.string(),
  id: z.string(),
})

export const BulkImportErrorRowSchema = z.object({
  row: z.number(),
  sku: z.string().optional(),
  error: z.string(),
  // Raw parsed columns for this row — lets the frontend export a
  // failed-rows CSV that mirrors the original file's own columns.
  record: z.record(z.string(), z.string()).optional(),
})

export const BulkImportItemsResultSchema = z.object({
  created: z.array(BulkImportCreatedRowSchema),
  errors: z.array(BulkImportErrorRowSchema),
  skippedBlankRows: z.number().optional(),
  // Rows whose model the catalog (or an earlier row) already has — e.g. the
  // same model on another PRICE USE row of a price list file.
  skippedExisting: z.array(z.object({ row: z.number(), model: z.string() })).optional(),
  // Rows with SERIAL + BRANCH, recorded as units on hand at that branch.
  units: z
    .object({
      created: z.number(),
      errors: z.array(z.object({ row: z.number(), serial: z.string(), error: z.string() })),
    })
    .optional(),
  // Rows with PRICE USE + PRICE, put on that price use's list.
  prices: z
    .discriminatedUnion('status', [
      z.object({ status: z.literal('no_price_columns') }),
      z.object({ status: z.literal('no_access') }),
      z.object({ status: z.literal('done'), result: PriceListImportResultSchema }),
      z.object({ status: z.literal('failed'), message: z.string() }),
    ])
    .optional(),
})

export type BulkImportCreatedRow = z.infer<typeof BulkImportCreatedRowSchema>
export type BulkImportErrorRow = z.infer<typeof BulkImportErrorRowSchema>
export type BulkImportItemsResult = z.infer<typeof BulkImportItemsResultSchema>
