'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check, Search } from 'lucide-react'

export type CategorySelectOption = { id: string; name: string; depth: number }

type Props = {
  value: string | undefined
  onChange: (value: string | undefined) => void
  options: CategorySelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function CategorySelect({
  value,
  onChange,
  options,
  placeholder = 'Select category…',
  className = '',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

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
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500 disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'border-prominent-purple-500 ring-1 ring-prominent-purple-500' : ''
        }`}
      >
        <span className={selected ? 'text-zinc-900' : 'text-zinc-400'}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories…"
              className="w-full text-sm outline-none placeholder:text-zinc-400"
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
                className="flex w-full items-center px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-50"
              >
                {placeholder}
              </button>
            )}
            {filteredOptions.length === 0 && (
              <p className="px-3 py-2 text-sm text-zinc-400">
                No categories match &ldquo;{query}&rdquo;
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
                className={`flex w-full items-center gap-2 py-2 pr-3 text-sm transition-colors hover:bg-zinc-50 ${
                  opt.id === value
                    ? 'bg-prominent-purple-50 text-prominent-purple-700'
                    : 'text-zinc-800'
                }`}
                style={{ paddingLeft: `${(normalizedQuery ? 0 : opt.depth) * 16 + 12}px` }}
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
