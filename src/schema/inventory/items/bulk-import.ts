import { z } from 'zod'

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
})

export type BulkImportCreatedRow = z.infer<typeof BulkImportCreatedRowSchema>
export type BulkImportErrorRow = z.infer<typeof BulkImportErrorRowSchema>
export type BulkImportItemsResult = z.infer<typeof BulkImportItemsResultSchema>
