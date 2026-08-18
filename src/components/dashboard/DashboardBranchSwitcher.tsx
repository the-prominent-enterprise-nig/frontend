'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Store } from 'lucide-react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { hasPrivilegedRole } from '@/src/libs/guards/permission'
import {
  getBranches,
  type BranchDetail,
} from '@/src/app/(app)/(dashboard)/settings/_actions/get-branches'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'

// Shares its store with the POS module's own branch switcher (see the store
// file's doc comment) so picking a branch here also scopes POS screens, and
// vice versa — one "which branch am I looking at" concept app-wide, not two
// that can silently disagree.
//
// Custom-rendered dropdown rather than a native <select> — with ~37 real
// branches in the seed data, the browser-native popup list looked jarringly
// inconsistent against the custom-styled pill trigger. Mirrors the
// open/outside-click/Escape pattern already established in
// src/components/ui/Select.tsx.
// Matches the dropdown's `w-52` Tailwind class below.
const DROPDOWN_WIDTH = 208

export function DashboardBranchSwitcher() {
  const [visible, setVisible] = useState(false)
  const [branches, setBranches] = useState<BranchDetail[]>([])
  const [open, setOpen] = useState(false)
  const [dropdownLeft, setDropdownLeft] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const { branchId, setBranch } = usePosBranchContext()

  useEffect(() => {
    getSessionOrNull().then((session) => {
      if (!session) return
      const privileged = hasPrivilegedRole(session)
      if (privileged) setVisible(true)

      // Self-heal a stale persisted branch id the same way PosBranchSwitcher
      // does — if it no longer matches a real branch, fall back to "All
      // Branches" instead of every widget silently filtering by a dead id.
      getBranches().then((res) => {
        const list = res.data ?? []
        if (privileged) setBranches(list)
        const currentBranchId = usePosBranchContext.getState().branchId
        if (currentBranchId && !list.some((b) => b.id === currentBranchId)) {
          usePosBranchContext.getState().setBranch(null)
        }
      })
    })
  }, [])

  // Right-aligns the dropdown to the trigger by default (matches the desktop
  // layout, where the trigger sits near the header's right edge), but clamps
  // it to stay fully on-screen — on a narrow viewport the trigger can end up
  // near the LEFT edge instead (e.g. after the header wraps), where a plain
  // `right-0` would push a fixed-width dropdown off the left of the screen.
  // Same clamping idea as DayPopover's anchor.left math, adapted for a
  // container-relative `absolute` position instead of a portal + `fixed` one.
  useLayoutEffect(() => {
    if (!open || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const idealScreenLeft = rect.right - DROPDOWN_WIDTH
    const clampedScreenLeft = Math.max(
      8,
      Math.min(idealScreenLeft, window.innerWidth - DROPDOWN_WIDTH - 8)
    )
    setDropdownLeft(clampedScreenLeft - rect.left)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!visible) return null

  function handleChange(id: string): void {
    setOpen(false)
    if (!id) {
      setBranch(null)
      return
    }
    const branch = branches.find((b) => b.id === id)
    if (branch) setBranch({ id: branch.id, name: branch.name })
  }

  const currentLabel = branchId
    ? (branches.find((b) => b.id === branchId)?.name ?? 'All Branches')
    : 'All Branches'

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={currentLabel}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50/60 py-1 pl-2.5 pr-2 text-xs text-purple-800 outline-none transition hover:border-purple-300 hover:bg-purple-100/60 focus-visible:ring-2 focus-visible:ring-purple-300"
      >
        <Store size={13} className="shrink-0 text-purple-500" />
        <span className="font-medium">{currentLabel}</span>
        <ChevronDown
          size={11}
          className={`shrink-0 text-purple-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          style={{ left: dropdownLeft }}
          className="absolute z-50 mt-1.5 max-h-64 w-52 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="option"
            aria-selected={!branchId}
            onClick={() => handleChange('')}
            className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-purple-50 ${
              !branchId ? 'font-medium text-purple-700' : 'text-zinc-700'
            }`}
          >
            All Branches
            {!branchId && <Check size={13} className="shrink-0 text-purple-600" />}
          </button>
          {branches.length > 0 && (
            <>
              <div className="my-1 border-t border-zinc-100" />
              {branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="option"
                  aria-selected={b.id === branchId}
                  onClick={() => handleChange(b.id)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-purple-50 ${
                    b.id === branchId ? 'font-medium text-purple-700' : 'text-zinc-700'
                  }`}
                >
                  <span className="truncate">{b.name}</span>
                  {b.id === branchId && <Check size={13} className="shrink-0 text-purple-600" />}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
