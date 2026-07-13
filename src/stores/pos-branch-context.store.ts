import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PosBranchContextStore {
  branchId: string | null
  branchName: string | null
  setBranch: (branch: { id: string; name: string } | null) => void
}

/** null branchId means "All Branches" — no filter applied. */
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
