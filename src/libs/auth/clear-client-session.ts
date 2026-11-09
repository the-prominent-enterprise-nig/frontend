'use client'

import { getQueryClient } from '@/src/libs/query/get-query-client'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { usePosPendingRefundStore } from '@/src/stores/pos-pending-refund.store'

/**
 * Wipes every piece of per-account state the browser holds onto between
 * logins. The browser QueryClient is a module-level singleton and logout is a
 * soft navigation, so without this the next account on the same tab is served
 * the previous account's cached queries (up to `staleTime`), plus the
 * localStorage-persisted branch selection and pending-refund badge.
 *
 * Called on logout AND right before navigating after a successful login, so
 * the logout paths that are plain `<form action>`s (403 page, super-admin
 * sidebar) are covered too.
 */
export function clearClientSession(): void {
  getQueryClient().clear()
  usePosBranchContext.getState().setBranch(null)
  usePosPendingRefundStore.getState().clear()
}
