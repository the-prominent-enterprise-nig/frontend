import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PendingRfdEntry {
  releaseFormRequestId: string
  itemName: string
  totalAmount: number
  submittedAt: string
  sessionId: string
  /** Whoever submitted this — lets the indicator hide/prune entries left
   * over from a different account that was previously logged in on this
   * same browser (localStorage isn't scoped per-account). */
  submittedByUserId: string
}

interface PosPendingRfdStore {
  entries: PendingRfdEntry[]
  add: (entry: PendingRfdEntry) => void
  remove: (releaseFormRequestId: string) => void
  clear: () => void
}

/** Tracks release-form requests submitted by this cashier that are still
 * awaiting manager approval, so the indicator can poll/notify on resolution. */
export const usePosPendingRfdStore = create<PosPendingRfdStore>()(
  persist(
    (set) => ({
      entries: [],
      add: (entry) =>
        set((state) => ({
          entries: [
            entry,
            ...state.entries.filter((e) => e.releaseFormRequestId !== entry.releaseFormRequestId),
          ],
        })),
      remove: (releaseFormRequestId) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.releaseFormRequestId !== releaseFormRequestId),
        })),
      clear: () => set({ entries: [] }),
    }),
    { name: 'pos-pending-rfd' }
  )
)
