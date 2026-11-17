'use client'

import type { ReactElement } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { MONO } from '@/src/libs/design/plex'
import { STALE } from '@/src/libs/query/stale-times'
import { getSeriesGaps } from '@/src/libs/actions/branch-series.actions'
import type {
  BranchSeriesDoc,
  BranchSeriesGaps,
  SeriesGap,
} from '@/src/schema/inventory/branch-series'

const DOC_NOUN: Record<BranchSeriesDoc, string> = {
  RR: 'receiving report',
  ST: 'stock transfer',
  DR: 'delivery receipt',
}

/** Gap ranges listed per branch before collapsing into "+N more". */
const SHOWN_GAPS = 5

/**
 * The "lacking series" notice on a Stock Transaction tab (NIG, 2026-11-16):
 * numbers issued in the branch's RR / ST / DR series that no document holds
 * now — a deleted draft, most often. Renders nothing while the series is
 * complete. Head office sees every branch with a gap.
 */
export function SeriesGapNotice({ doc }: { doc: BranchSeriesDoc }): ReactElement | null {
  const query = useQuery({
    queryKey: ['series-gaps', doc],
    queryFn: () => getSeriesGaps(doc),
    staleTime: STALE.REALTIME,
  })
  const branches = (query.data?.success && query.data.data) || []
  if (branches.length === 0) return null

  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="min-w-0 space-y-1">
        {branches.map((b) => (
          <BranchLine key={b.branchId} branch={b} doc={doc} />
        ))}
        <p className="text-xs text-amber-800">
          Issued, but no {DOC_NOUN[doc]} holds them now — usually a deleted draft.
        </p>
      </div>
    </div>
  )
}

function BranchLine({
  branch,
  doc,
}: {
  branch: BranchSeriesGaps
  doc: BranchSeriesDoc
}): ReactElement {
  const shown = branch.gaps.slice(0, SHOWN_GAPS)
  const more = branch.gaps.slice(SHOWN_GAPS).reduce((sum, g) => sum + g.count, 0)
  const noun = branch.missingCount === 1 ? 'number' : 'numbers'
  return (
    <p>
      <span className="font-medium">
        {branch.missingCount} {noun} missing from {branch.branchName}&apos;s {doc} series:
      </span>{' '}
      {shown.map((g, i) => (
        <span key={g.from}>
          {i > 0 && ', '}
          <GapText gap={g} />
        </span>
      ))}
      {more > 0 && <span> +{more} more</span>}
    </p>
  )
}

function GapText({ gap }: { gap: SeriesGap }): ReactElement {
  if (gap.count === 1) return <span className={MONO}>{gap.from}</span>
  return (
    <span className={MONO}>
      {gap.from} – {gap.to} <span className="font-sans">({gap.count})</span>
    </span>
  )
}
