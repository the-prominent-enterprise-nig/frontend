import { manilaDateOf, manilaToday } from '@/src/libs/format/manila-date'
import type { PosSession } from '@/src/schema/pos'

/**
 * The cashier's sessions that are still open but were opened on an earlier
 * Manila business day — a drawer left open overnight. Oldest first.
 */
export function staleOpenSessions(
  sessions: PosSession[],
  cashierId: string,
  today: string = manilaToday()
): PosSession[] {
  return sessions
    .filter(
      (s) => s.status === 'open' && s.cashierId === cashierId && manilaDateOf(s.openedAt) < today
    )
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt))
}
