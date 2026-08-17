import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PosBranchContextStore {
  branchId: string | null
  branchName: string | null
  setBranch: (branch: { id: string; name: string } | null) => void
}

/**
 * null branchId means "All Branches" — no filter applied.
 *
 * Also used by the main dashboard's branch switcher
 * (`src/components/dashboard/DashboardBranchSwitcher.tsx`), despite the
 * "pos" name — kept as one shared store rather than a POS-only one plus a
 * dashboard-only one, so switching branches in either place stays in sync.
 */
export const usePosBranchContext = create<PosBranchContextStore>()(
  persist(
    (set) => ({
      branchId: null,
      branchName: null,
      setBranch: (branch) =>
        set({ branchId: branch?.id ?? null, branchName: branch?.name ?? null }),
    }),
    { name: 'pos-branch-context' }
  )
)
