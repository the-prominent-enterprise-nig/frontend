'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'
import { useOpenUpward } from '@/src/hooks/useOpenUpward'

export type CategorySelectOption = { id: string; name: string; depth: number }

type Props = {
  value: string | undefined
  onChange: (value: string | undefined) => void
  options: CategorySelectOption[]
  placeholder?: string
  /** What the list holds, lowercase plural — this component is reused for
   * suppliers, bank accounts, invoices etc., not just categories, and the
   * search box and empty state both read wrong when they say "categories"
   * for those. */
  noun?: string
  className?: string
  disabled?: boolean
  'aria-label'?: string
  /** Tighter padding/font for dense layouts (e.g. a table row) — everything
   * else about the component stays the same. Off by default so existing
   * usages are unaffected. */
  compact?: boolean
}

export default function CategorySelect({
  value,
  onChange,
  options,
  placeholder = 'Select category…',
  noun = 'categories',
  className = '',
  disabled = false,
  'aria-label': ariaLabel,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const openUpward = useOpenUpward(open, containerRef, popupRef)

  const selected = options.find((o) => o.id === value)
  const normalizedQuery = query.trim().toLowerCase()
  // Matches against both top-level categories and their subcategories — all
  // depths live in the same flat `options` array, so one substring filter
  // over the name covers "search the main and the sub".
  const filteredOptions = normalizedQuery
    ? options.filter((o) => o.name.toLowerCase().includes(normalizedQuery))
    : options

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  useEffect(() => {
    if (open) searchRef.current?.focus()
    else setQuery('')
  }, [open])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full min-w-0 items-center justify-between rounded-lg border border-zinc-200 bg-white outline-none transition-colors focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 disabled:cursor-not-allowed disabled:opacity-50 ${
          compact ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-sm'
        } ${open ? 'border-prominent-purple-500 ring-1 ring-prominent-purple-500' : ''}`}
      >
        <span className={`truncate ${selected ? 'text-zinc-900' : 'text-zinc-400'}`}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          ref={popupRef}
          className={`absolute left-0 right-0 z-50 max-h-72 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg ${
            openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          <div
            className={`flex items-center gap-2 border-b border-zinc-100 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${noun}…`}
              className={`w-full outline-none placeholder:text-zinc-400 ${compact ? 'text-[13px]' : 'text-sm'}`}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {!normalizedQuery && (
              <button
                type="button"
                onClick={() => {
                  onChange(undefined)
                  setOpen(false)
                }}
                className={`flex w-full items-center text-zinc-400 hover:bg-zinc-50 ${
                  compact ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-sm'
                }`}
              >
                {placeholder}
              </button>
            )}
            {filteredOptions.length === 0 && (
              <p
                className={`text-zinc-400 ${compact ? 'px-2.5 py-1.5 text-[13px]' : 'px-3 py-2 text-sm'}`}
              >
                No {noun} match &ldquo;{query}&rdquo;
              </p>
            )}
            {filteredOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 transition-colors hover:bg-zinc-50 ${
                  compact ? 'py-1.5 pr-2.5 text-[13px]' : 'py-2 pr-3 text-sm'
                } ${
                  opt.id === value
                    ? 'bg-prominent-purple-50 text-prominent-purple-700'
                    : 'text-zinc-800'
                }`}
                style={{
                  paddingLeft: `${(normalizedQuery ? 0 : opt.depth) * (compact ? 14 : 16) + (compact ? 10 : 12)}px`,
                }}
              >
                {!normalizedQuery && opt.depth > 0 && (
                  <span className="shrink-0 text-zinc-300">{'—'.repeat(opt.depth)}</span>
                )}
                <span className="flex-1 text-left">{opt.name}</span>
                {opt.id === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
