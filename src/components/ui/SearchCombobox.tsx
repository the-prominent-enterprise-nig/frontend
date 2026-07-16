'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Loader2 } from 'lucide-react'

export type SearchComboboxOption = {
  id: string
  primary: string
  secondary?: string
}

type Props = {
  value: string
  onChange: (id: string) => void
  queryKey: string
  search: (query: string) => Promise<SearchComboboxOption[]>
  placeholder?: string
  emptyMessage?: string
  typeToSearchMessage?: string
  error?: string
  disabled?: boolean
}

/**
 * Generic debounced async-search dropdown. `search` is called (debounced,
 * 300ms) with the current query whenever the dropdown is open, including
 * with an empty string on first open — callers decide what that returns
 * (e.g. a server search action, or a client-side filter over an
 * already-loaded list).
 */
export function SearchCombobox({
  value,
  onChange,
  queryKey,
  search,
  placeholder,
  emptyMessage = 'No results found',
  typeToSearchMessage = 'Type to search…',
  error,
  disabled,
}: Props) {
  // confirmedLabel: what gets shown when the dropdown is closed (only changes on select/clear)
  const [confirmedLabel, setConfirmedLabel] = useState('')
  // searchQuery: what the user is typing while the dropdown is open
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Clear confirmed label when value is reset externally (form reset)
  useEffect(() => {
    if (!value) setConfirmedLabel('')
  }, [value])

  // Close on outside click — restore confirmed label without losing the form value
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: [queryKey, debouncedQuery],
    queryFn: () => search(debouncedQuery),
    enabled: open,
    staleTime: 30_000,
  })

  const options = data ?? []

  function handleSelect(option: SearchComboboxOption) {
    onChange(option.id)
    setConfirmedLabel(option.secondary ? `${option.primary} (${option.secondary})` : option.primary)
    setSearchQuery('')
    setOpen(false)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setConfirmedLabel('')
    setSearchQuery('')
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const displayValue = open ? searchQuery : confirmedLabel

  const borderClass = error
    ? 'border-red-400'
    : open
      ? 'border-prominent-purple-500 ring-1 ring-prominent-purple-500'
      : 'border-zinc-200'

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2 transition-colors ${borderClass} ${disabled ? 'opacity-60' : ''}`}
      >
        <Search className="h-4 w-4 shrink-0 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => !disabled && setOpen(true)}
          disabled={disabled}
          placeholder={confirmedLabel || placeholder || typeToSearchMessage}
          className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded p-0.5 text-zinc-400 hover:text-zinc-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            </div>
          ) : options.length === 0 ? (
            <p className="px-3 py-3 text-sm text-zinc-400">
              {debouncedQuery ? `${emptyMessage} for "${debouncedQuery}"` : typeToSearchMessage}
            </p>
          ) : (
            options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option)}
                className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-zinc-50 ${
                  option.id === value
                    ? 'bg-prominent-purple-50 text-prominent-purple-700'
                    : 'text-zinc-800'
                }`}
              >
                <span className="font-medium">{option.primary}</span>
                {option.secondary && (
                  <span className="font-mono text-xs text-zinc-400">{option.secondary}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
