import { z } from 'zod'

export const SerializedImportRowErrorSchema = z.object({
  row: z.number(),
  field: z.string().optional(),
  value: z.string().optional(),
  error: z.string(),
  // Raw parsed columns for this row — lets the frontend export a
  // failed-rows CSV that mirrors the original file's own columns.
  record: z.record(z.string(), z.string()).optional(),
})

export const SerializedImportResultSchema = z.object({
  created: z.number(),
  skipped: z.number(),
  skippedBlankRows: z.number().optional(),
  dryRun: z.boolean(),
  errors: z.array(SerializedImportRowErrorSchema),
})

export type SerializedImportRowError = z.infer<typeof SerializedImportRowErrorSchema>
export type SerializedImportResult = z.infer<typeof SerializedImportResultSchema>
