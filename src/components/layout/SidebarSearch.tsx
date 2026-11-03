'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, type LucideIcon } from 'lucide-react'

/**
 * One page the search can take you to. Built by the sidebar from the same
 * navigation it draws, filtered by the same permissions, so search never offers
 * a page the signed-in user could not open from the menu.
 */
export type SearchEntry = {
  label: string
  href: string
  icon: LucideIcon
  /** Where it lives, outermost first — ['Accounting', 'Receivables']. */
  path: string[]
}

const MAX_RESULTS = 8

/** Lower is better; null means this entry does not match. Every word typed must match. */
function score(entry: SearchEntry, tokens: string[]): number | null {
  const label = entry.label.toLowerCase()
  const words = label.split(/[\s&/\-–—]+/)
  const where = entry.path.join(' ').toLowerCase()
  let total = 0
  for (const token of tokens) {
    if (label.startsWith(token)) total += 0
    else if (words.some((w) => w.startsWith(token))) total += 1
    else if (label.includes(token)) total += 2
    else if (where.includes(token)) total += 4
    else return null
  }
  return total
}

export function searchEntries(entries: SearchEntry[], query: string): SearchEntry[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  return entries
    .map((entry) => ({ entry, s: score(entry, tokens) }))
    .filter((r): r is { entry: SearchEntry; s: number } => r.s !== null)
    .sort(
      (a, b) =>
        a.s - b.s ||
        a.entry.label.length - b.entry.label.length ||
        a.entry.label.localeCompare(b.entry.label)
    )
    .slice(0, MAX_RESULTS)
    .map((r) => r.entry)
}

/**
 * Search at the top of the sidebar, like Shopify's: type a page's name, pick it
 * (click, or arrows + Enter). Ctrl/⌘ + K jumps to it from anywhere. On a
 * collapsed sidebar it is a single icon that opens the sidebar and focuses it.
 */
export default function SidebarSearch({
  entries,
  collapsed,
  onExpand,
}: {
  entries: SearchEntry[]
  collapsed: boolean
  onExpand: () => void
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const focusWhenExpanded = useRef(false)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // The server cannot know the platform, so this is told apart on the client
  // only (the hint's own hydration warning is suppressed below).
  const hint =
    typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform)
      ? '⌘K'
      : 'Ctrl K'

  const results = useMemo(() => searchEntries(entries, query), [entries, query])
  const showPanel = open && query.trim().length > 0

  // Ctrl/⌘ + K, from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return
      e.preventDefault()
      if (collapsed) {
        focusWhenExpanded.current = true
        onExpand()
        return
      }
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [collapsed, onExpand])

  // The icon on a collapsed sidebar opens it; the field is there next render.
  useEffect(() => {
    if (!collapsed && focusWhenExpanded.current) {
      focusWhenExpanded.current = false
      inputRef.current?.focus()
    }
  }, [collapsed])

  // A click anywhere else closes the list.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function finish() {
    setOpen(false)
    setQuery('')
    setActive(0)
    inputRef.current?.blur()
  }

  function go(entry: SearchEntry) {
    finish()
    router.push(entry.href)
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => {
          focusWhenExpanded.current = true
          onExpand()
        }}
        aria-label="Search"
        title={`Search (${hint})`}
        className="mx-auto flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Search className="h-5 w-5" />
      </button>
    )
  }

  return (
    <div ref={rootRef} className="relative shrink-0 px-1" data-testid="sidebar-search">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Search pages"
        aria-expanded={showPanel}
        aria-controls="sidebar-search-results"
        aria-activedescendant={
          showPanel && results[active] ? `sidebar-search-${active}` : undefined
        }
        autoComplete="off"
        spellCheck={false}
        placeholder="Search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && results.length > 0) {
            e.preventDefault()
            setOpen(true)
            setActive((a) => (a + 1) % results.length)
          } else if (e.key === 'ArrowUp' && results.length > 0) {
            e.preventDefault()
            setActive((a) => (a - 1 + results.length) % results.length)
          } else if (e.key === 'Enter' && showPanel && results[active]) {
            e.preventDefault()
            go(results[active])
          } else if (e.key === 'Escape') {
            if (query) setQuery('')
            else inputRef.current?.blur()
            setOpen(false)
          }
        }}
        className="h-9 w-full rounded-lg border border-white/15 bg-white/10 pl-9 pr-14 text-sm text-white outline-none transition-colors placeholder:text-white/60 focus:border-white/40 focus:bg-white/20"
      />
      {!query && (
        <kbd
          suppressHydrationWarning
          className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 rounded border border-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white/70"
        >
          {hint}
        </kbd>
      )}

      {showPanel && (
        <div
          id="sidebar-search-results"
          role="listbox"
          className="absolute left-1 top-full z-100 mt-2 w-88 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl bg-white py-1.5 text-gray-800 shadow-2xl ring-1 ring-black/5"
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">No pages match “{query.trim()}”.</p>
          ) : (
            results.map((entry, i) => (
              <Link
                key={`${entry.href}|${entry.label}`}
                id={`sidebar-search-${i}`}
                role="option"
                aria-selected={i === active}
                href={entry.href}
                onClick={finish}
                onMouseEnter={() => setActive(i)}
                className={`flex items-center gap-3 px-4 py-2 transition-colors ${
                  i === active ? 'bg-prominent-purple-50' : ''
                }`}
              >
                <entry.icon className="h-4 w-4 shrink-0 text-prominent-purple-600" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {entry.label}
                  </span>
                  {entry.path.length > 0 && (
                    <span className="block truncate text-xs text-gray-500">
                      {entry.path.join(' › ')}
                    </span>
                  )}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
