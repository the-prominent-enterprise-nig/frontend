import { z } from 'zod'

/** The three per-branch document series (backend: inventory/utils/branch-series.util). */
export const BRANCH_SERIES_DOCS = ['RR', 'ST', 'DR'] as const
export type BranchSeriesDoc = (typeof BRANCH_SERIES_DOCS)[number]

/** One run of numbers issued in a branch's series that no document holds. */
export const SeriesGapSchema = z.object({
  from: z.string(),
  to: z.string(),
  count: z.number(),
})

/** A branch whose series has numbers missing. */
export const BranchSeriesGapsSchema = z.object({
  branchId: z.string(),
  branchName: z.string(),
  suffix: z.string(),
  missingCount: z.number(),
  gaps: z.array(SeriesGapSchema),
})

export const BranchSeriesGapsListSchema = z.array(BranchSeriesGapsSchema)

export type SeriesGap = z.infer<typeof SeriesGapSchema>
export type BranchSeriesGaps = z.infer<typeof BranchSeriesGapsSchema>
