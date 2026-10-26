'use client'

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { Check, ChevronDown, Search, Store } from 'lucide-react'
import { getSessionIfAvailable } from '@/src/libs/auth/actions'
import { hasPrivilegedRole } from '@/src/libs/guards/permission'
import { getBranches, type Branch } from '../_actions/pos-actions'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'

// Matches the dropdown's `w-52` Tailwind class below.
const DROPDOWN_WIDTH = 208

/** A branch user's own branch and the running caravans it hosts — the
 *  places they can work the POS for. (getBranches already leaves out ended
 *  and closed caravans.) */
function ownPlaces(list: Branch[], ownBranchId: string): Branch[] {
  return list.filter(
    (b) => b.id === ownBranchId || (b.isTemporary && b.hostBranchId === ownBranchId)
  )
}

export function PosBranchSwitcher() {
  const [visible, setVisible] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  // Set for a branch user: their own branch, which stands in for "All
  // Branches" (null) since they only ever see their own.
  const [ownBranch, setOwnBranch] = useState<Branch | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [dropdownLeft, setDropdownLeft] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()
  const { branchId, setBranch } = usePosBranchContext()

  useEffect(() => {
    getSessionIfAvailable().then((session) => {
      if (!session) return
      const privileged = hasPrivilegedRole(session)
      if (privileged) setVisible(true)
      const ownBranchId = privileged ? null : (session.branchId ?? null)

      // Every POS page — regardless of role — filters its lists by this
      // shared, localStorage-persisted branch id, but only privileged roles
      // (and a branch hosting caravans, between those) can see the switcher
      // to change it. If the id was deleted, renamed, or
      // the database was reseeded since it was picked, it silently matches no
      // branch: the dropdown falls back to showing "All Branches" for owners,
      // while every list (including for non-owners, who never see the
      // dropdown at all) keeps filtering by the dead id and stays empty no
      // matter how much you refresh. Validate and self-heal for everyone.
      getBranches().then((res) => {
        const all = res.data ?? []
        // A host branch's cashier or manager moves between their branch and
        // the caravans it hosts, so a caravan register's lists and stock are
        // the caravan's own.
        const places = ownBranchId ? ownPlaces(all, ownBranchId) : []
        if (privileged) setBranches(all)
        else if (places.length > 1) {
          setBranches(places.filter((b) => b.id !== ownBranchId))
          setOwnBranch(places.find((b) => b.id === ownBranchId) ?? null)
          setVisible(true)
        }
        // A branch user only ever matches their own places — an owner's
        // leftover pick on a shared device would otherwise empty every list.
        const list = privileged ? all : places
        const currentBranchId = usePosBranchContext.getState().branchId
        if (!currentBranchId) return
        // Also refreshes the persisted name, so a renamed branch (or a
        // caravan now shown by its place) doesn't keep its old label.
        const current = list.find((b) => b.id === currentBranchId)
        usePosBranchContext.getState().setBranch(current ?? null)
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

  // Lands the cursor in the search box so typing filters straight away.
  useEffect(() => {
    if (open) searchRef.current?.focus()
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

  // With dozens of branches, scrolling is slow — typing narrows the list.
  const needle = query.trim().toLowerCase()
  const filteredBranches = needle
    ? branches.filter((b) => b.name.toLowerCase().includes(needle))
    : branches

  function handleSearchKeyDown(e: ReactKeyboardEvent<HTMLInputElement>): void {
    // Enter picks the top match, so it works without leaving the keyboard.
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (filteredBranches[0] && needle) handleChange(filteredBranches[0].id)
  }

  const allLabel = ownBranch?.name ?? 'All Branches'
  const currentLabel = branchId
    ? (branches.find((b) => b.id === branchId)?.name ?? allLabel)
    : allLabel

  return (
    <div ref={containerRef} data-testid="pos-branch-switcher" className="relative shrink-0">
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={currentLabel}
        onClick={() => {
          setQuery('')
          setOpen((o) => !o)
        }}
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
          style={{ left: dropdownLeft }}
          className="absolute z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg"
        >
          <div className="flex items-center gap-1.5 border-b border-zinc-100 px-3 py-2">
            <Search size={13} className="shrink-0 text-zinc-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={ownBranch ? 'Search caravans…' : 'Search branches…'}
              aria-label="Search branches"
              aria-controls={listboxId}
              className="w-full min-w-0 bg-transparent text-xs text-zinc-700 outline-none placeholder:text-zinc-400"
            />
          </div>
          <div id={listboxId} role="listbox" className="max-h-56 overflow-y-auto py-1">
            {!needle && (
              <button
                type="button"
                role="option"
                aria-selected={!branchId}
                onClick={() => handleChange('')}
                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-purple-50 ${
                  !branchId ? 'font-medium text-purple-700' : 'text-zinc-700'
                }`}
              >
                {allLabel}
                {!branchId && <Check size={13} className="shrink-0 text-purple-600" />}
              </button>
            )}
            {!needle && filteredBranches.length > 0 && (
              <div className="my-1 border-t border-zinc-100" />
            )}
            {filteredBranches.map((b) => (
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
            {needle && filteredBranches.length === 0 && (
              <p className="px-3 py-2 text-xs text-zinc-400">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
