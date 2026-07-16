import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface PendingRefundEntry {
  returnRefundRequestId: string
  itemName: string
  totalAmount: number
  submittedAt: string
  sessionId: string
}

interface PosPendingRefundStore {
  entries: PendingRefundEntry[]
  add: (entry: PendingRefundEntry) => void
  remove: (returnRefundRequestId: string) => void
  clear: () => void
}

/** Tracks refund requests submitted by this cashier that are still awaiting
 * manager approval, so the indicator can poll/notify on resolution. Mirrors
 * pos-pending-rfd.store.ts's shape for the new unified return-refund model. */
export const usePosPendingRefundStore = create<PosPendingRefundStore>()(
  persist(
    (set) => ({
      entries: [],
      add: (entry) =>
        set((state) => ({
          entries: [
            entry,
            ...state.entries.filter((e) => e.returnRefundRequestId !== entry.returnRefundRequestId),
          ],
        })),
      remove: (returnRefundRequestId) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.returnRefundRequestId !== returnRefundRequestId),
        })),
      clear: () => set({ entries: [] }),
    }),
    { name: 'pos-pending-refund' }
  )
)
