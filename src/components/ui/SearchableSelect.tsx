'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'

export type SearchableSelectOption = { value: string; label: string }

type Props = {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  loadingLabel?: string
  loading?: boolean
  disabled?: boolean
  className?: string
  /** Shows a small "×" to reset back to no selection once a value is picked
   * — there's otherwise no way back to the placeholder state from inside
   * the control itself (picking a different option is the only other way
   * `value` ever changes). Off by default since not every consumer wants a
   * "no selection" state to be reachable (e.g. a required field). */
  clearable?: boolean
}

/** Type-ahead select — typing filters the option list (like Shopee/Lazada's
 * address pickers), rather than a plain native <select> the user has to
 * scroll through. */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  loadingLabel = 'Loading…',
  loading = false,
  disabled = false,
  className = '',
  clearable = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const displayValue = open ? query : (selected?.label ?? '')

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-center rounded-lg border bg-white pr-2 transition-colors ${
          open ? 'border-prominent-purple-500 ring-1 ring-prominent-purple-500' : 'border-gray-200'
        } ${disabled ? 'bg-gray-50' : ''}`}
      >
        <input
          ref={inputRef}
          value={displayValue}
          disabled={disabled}
          placeholder={loading ? loadingLabel : placeholder}
          onFocus={(e) => {
            // Reopening after a value is already picked used to blank the
            // visible text back to an empty search box — the selection was
            // still held in `value` underneath, but it LOOKED cleared. Seed
            // the query with the current label so it stays visible; typing
            // still overwrites/filters as normal, and selecting all text
            // lets a single keystroke replace it like a typical combobox.
            setQuery(selected?.label ?? '')
            setOpen(true)
            e.target.select()
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          className="w-full rounded-lg bg-transparent px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:text-gray-400"
        />
        {clearable && value && !disabled && (
          <button
            type="button"
            aria-label="Clear selection"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange('')
              setQuery('')
              setOpen(false)
            }}
            className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-sm text-gray-400">{loadingLabel}</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">No matches</p>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setQuery('')
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                  opt.value === value
                    ? 'bg-prominent-purple-50 text-prominent-purple-700'
                    : 'text-gray-800'
                }`}
              >
                {opt.label}
                {opt.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
