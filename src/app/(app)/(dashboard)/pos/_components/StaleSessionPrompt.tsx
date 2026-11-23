'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, CalendarClock, Monitor } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getSessions } from '../_actions/pos-actions'
import { staleOpenSessions } from '../_shared/stale-sessions'
import { formatManilaDateTime } from '@/src/libs/format/manila-date'
import { terminalPlaceName } from '@/src/libs/format/locationLabel'

/**
 * Blocks Checkout while the cashier still has a session open from an earlier
 * (Manila) day — yesterday's drawer was never closed. It can't be dismissed:
 * until that session is closed its drawer is never counted, its cash can't be
 * deposited (deposits and Cash-in-Transit only take closed sessions), and the
 * Daily Collection Report keeps its money as pending.
 *
 * The only way out is the Sessions list, where each open session has its own
 * Close button. Cashiers hold `pos:sessions:*` (Sales Counter), so they can
 * close their own. Once nothing is stale the list comes back empty and
 * Checkout is usable again.
 *
 * It covers only the page area (the POS layout's page grid cell), not the
 * sidebar, top bar or POS tabs, so the cashier can still go to other screens.
 */
export function StaleSessionPrompt({ userId }: { userId: string | null }) {
  const pathname = usePathname()
  if (!userId || !pathname.startsWith('/pos/checkout')) return null
  return <CheckoutBlock userId={userId} />
}

function CheckoutBlock({ userId }: { userId: string }) {
  // Same query as useSessions() in _hooks/usePos (same key, so it shares the
  // cache and the close/open invalidations), but not imported from there: this
  // renders in the POS layout on every page, and pulling usePos (and with it
  // every POS server action) into the layout made the server-rendered HTML
  // intermittently fail to hydrate. One action, like PendingRefundIndicator.
  const filters = { cashierId: userId, status: 'open' }
  const { data, isFetchedAfterMount } = useQuery({
    queryKey: ['pos-sessions', filters],
    queryFn: () => getSessions(filters),
    // Asked fresh on every visit, and again on focus, so a till left open
    // overnight is caught the morning after.
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
  const stale = useMemo(() => staleOpenSessions(data?.data ?? [], userId), [data, userId])

  // Wait for this visit's answer: the cached list from an earlier visit may
  // still hold sessions closed since (on the Sessions page), and showing it
  // would flash the block before the refetch clears it.
  if (!isFetchedAfterMount || stale.length === 0) return null

  const one = stale.length === 1
  const session = stale[0]
  const place = terminalPlaceName(session.terminal)

  return (
    // Placed in the POS layout's page grid cell (on top of the page), not
    // `fixed`: it fills the page area only. The backdrop has no onClick —
    // clicking it doesn't close the block. No backdrop-blur: it
    // left a thin vertical seam along the sidebar edge on GPU-rendered Chrome
    // whenever a POS tab was hovered.
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="stale-session-title"
      aria-describedby="stale-session-desc"
      data-testid="stale-session-block"
      className="z-30 col-start-1 row-start-1 flex items-start justify-center overflow-y-auto overscroll-contain bg-gray-900/45 p-4"
    >
      <div className="my-auto w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl ring-1 ring-black/5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 ring-8 ring-amber-50">
          <CalendarClock size={22} className="text-amber-600" />
        </div>

        <h2
          id="stale-session-title"
          className="mt-5 text-lg font-semibold text-balance text-gray-900"
        >
          {one
            ? 'Close your session from an earlier day'
            : `You have ${stale.length} sessions still open`}
        </h2>
        <p id="stale-session-desc" className="mt-1.5 text-sm text-balance text-gray-500">
          {one
            ? 'Close it to continue selling.'
            : 'They were opened on earlier days. Close them to continue selling.'}
        </p>

        {/* One session gets its card; several get only the count above —
            the Sessions page has each one with its own Close button. */}
        {one && (
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3 text-left">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-amber-200">
              <Monitor size={16} className="text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">
                {session.terminal?.name ?? 'Terminal'}
                {place && <span className="font-normal text-gray-500"> · {place}</span>}
              </p>
              <p className="text-xs text-amber-700">
                Opened{' '}
                {formatManilaDateTime(session.openedAt, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        )}

        <Link
          href="/pos/sessions"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-prominent-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-prominent-purple-500 focus-visible:ring-offset-2"
        >
          Go to Sessions
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
