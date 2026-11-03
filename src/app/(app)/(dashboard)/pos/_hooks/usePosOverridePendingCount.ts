'use client'

import { useQuery } from '@tanstack/react-query'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'

/**
 * Pending Override Review entries — the badge on the sidebar's Approvals item
 * and on the Override Review tab. It follows the branch switcher — the review
 * page is filtered by it, so a count across every branch beside a page showing
 * one branch's entries disagreed — and shares its query key with the page, so
 * approving or rejecting there updates it at once.
 *
 * `enabled` is for the caller to say whether the badge shows at all: only for
 * someone who can open the review, and only inside POS.
 */
export function usePosOverridePendingCount(enabled: boolean): number {
  const posBranchId = usePosBranchContext((s) => s.branchId)
  const { data } = useQuery({
    queryKey: ['pos-override-pending-count', posBranchId],
    // A plain request through the API proxy, not a server action: server actions
    // run one at a time and a newer one cancels an older, so a count refreshing in
    // the background could knock out a save the user had just made on the page.
    queryFn: async () => {
      const qs = posBranchId ? `?branchId=${encodeURIComponent(posBranchId)}` : ''
      const res = await fetch(`/api/pos/override-review/pending-count${qs}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Could not load the pending override count')
      return (await res.json()) as { count: number }
    },
    enabled,
    staleTime: 15_000,
  })
  return data?.count ?? 0
}
