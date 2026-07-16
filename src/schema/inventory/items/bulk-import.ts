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
})

export const BulkImportItemsResultSchema = z.object({
  created: z.array(BulkImportCreatedRowSchema),
  errors: z.array(BulkImportErrorRowSchema),
})

export type BulkImportCreatedRow = z.infer<typeof BulkImportCreatedRowSchema>
export type BulkImportErrorRow = z.infer<typeof BulkImportErrorRowSchema>
export type BulkImportItemsResult = z.infer<typeof BulkImportItemsResultSchema>
