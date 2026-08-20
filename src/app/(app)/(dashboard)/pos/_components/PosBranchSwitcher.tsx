'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Store } from 'lucide-react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { hasPrivilegedRole } from '@/src/libs/guards/permission'
import { getBranches, type Branch } from '../_actions/pos-actions'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'

// Matches the dropdown's `w-52` Tailwind class below.
const DROPDOWN_WIDTH = 208

export function PosBranchSwitcher() {
  const [visible, setVisible] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
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

      // Every POS page — regardless of role — filters its lists by this
      // shared, localStorage-persisted branch id, but only privileged roles
      // can see the switcher to change it. If the id was deleted, renamed, or
      // the database was reseeded since it was picked, it silently matches no
      // branch: the dropdown falls back to showing "All Branches" for owners,
      // while every list (including for non-owners, who never see the
      // dropdown at all) keeps filtering by the dead id and stays empty no
      // matter how much you refresh. Validate and self-heal for everyone.
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

  // Clamps the dropdown to stay on-screen when the trigger sits near the
  // left edge (e.g. after the top bar wraps on a narrow viewport), where a
  // plain `right-0` would push a fixed-width dropdown off-screen.
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
    if (branch) setBranch(branch)
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
