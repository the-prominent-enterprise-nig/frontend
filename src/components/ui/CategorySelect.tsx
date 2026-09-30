'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export type CategorySelectOption = { id: string; name: string; depth: number }

type Props = {
  value: string | undefined
  onChange: (value: string | undefined) => void
  options: CategorySelectOption[]
  placeholder?: string
  /** What the list holds, lowercase plural — this component is reused for
   * suppliers, bank accounts, invoices etc., not just categories, and the
   * empty state reads wrong when it says "categories" for those. */
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
  // A query seeded from the current selection is for DISPLAY only — it
  // keeps the chosen label visible in the trigger, but must not filter the
  // list down to just that one option. Reopening should show everything
  // until the user actually types (same fix SearchableSelect uses).
  const [querySeeded, setQuerySeeded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.id === value)
  const normalizedQuery = querySeeded ? '' : query.trim().toLowerCase()
  // Matches against both top-level categories and their subcategories — all
  // depths live in the same flat `options` array, so one substring filter
  // over the name covers "search the main and the sub".
  const filteredOptions = normalizedQuery
    ? options.filter((o) => o.name.toLowerCase().includes(normalizedQuery))
    : options

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      // popupRef too, not just containerRef: the popup is portalled to
      // <body>, so it is no longer a descendant of the trigger. Checking only
      // the trigger would close the popup on its own options.
      if (!containerRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        setOpen(false)
        setQuery('')
        setQuerySeeded(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const [position, setPosition] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)

  const updatePosition = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [])

  // Portal the popup to <body> and track the trigger's position — same
  // approach SearchCombobox takes, and for the same reason: an absolutely
  // positioned popup is clipped by any scrolling ancestor, which this sits
  // inside constantly (a line-item grid within a modal).
  useEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener('resize', updatePosition)
    document.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      document.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  function openWithSeed() {
    setQuery(selected?.name ?? '')
    setQuerySeeded(!!selected)
    setOpen(true)
  }

  function close() {
    setOpen(false)
    setQuery('')
    setQuerySeeded(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* The search box IS the trigger — typing here filters directly,
          instead of opening a button that then reveals a second, separate
          search field inside the popup (developer decision, 2026-09-26: the
          two-step version read as one extra click for no reason). */}
      <div
        className={`flex w-full min-w-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white transition-colors focus-within:border-prominent-purple-500 focus-within:ring-1 focus-within:ring-prominent-purple-500 ${
          disabled ? 'cursor-not-allowed bg-zinc-50 opacity-50' : ''
        } ${compact ? 'py-1.5 pl-2.5 pr-1.5' : 'py-2 pl-3 pr-2'} ${
          open ? 'border-prominent-purple-500 ring-1 ring-prominent-purple-500' : ''
        }`}
      >
        <input
          ref={inputRef}
          aria-label={ariaLabel}
          disabled={disabled}
          value={open ? query : (selected?.name ?? '')}
          placeholder={placeholder}
          onFocus={() => {
            if (!open) openWithSeed()
            inputRef.current?.select()
          }}
          onClick={() => {
            if (!open) openWithSeed()
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setQuerySeeded(false)
            if (!open) setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            if (e.key === 'ArrowDown' && !open) openWithSeed()
          }}
          className={`w-full min-w-0 bg-transparent text-left outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed ${
            compact ? 'text-[13px]' : 'text-sm'
          } ${selected && !open ? 'text-zinc-900' : ''}`}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? 'Close options' : 'Open options'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) {
              close()
              return
            }
            openWithSeed()
            inputRef.current?.focus()
          }}
          className="shrink-0 rounded p-0.5 text-zinc-400 disabled:cursor-not-allowed"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open &&
        position &&
        createPortal(
          <div
            ref={popupRef}
            style={{ top: position.top, left: position.left, width: position.width }}
            className="fixed z-100 max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
          >
            {!normalizedQuery && (
              <button
                type="button"
                onClick={() => {
                  onChange(undefined)
                  close()
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
                  close()
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
          </div>,
          document.body
        )}
    </div>
  )
}
