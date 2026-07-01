'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X, Loader2 } from 'lucide-react'
import { getSuppliers } from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_actions/get-suppliers'

type Props = {
  value: string
  onChange: (id: string) => void
  error?: string
}

export function SupplierSearchCombobox({ value, onChange, error }: Props) {
  const [confirmedLabel, setConfirmedLabel] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    if (!value) setConfirmedLabel('')
  }, [value])

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
    queryKey: ['suppliers-search', debouncedQuery],
    queryFn: () => getSuppliers({ search: debouncedQuery || undefined, limit: 20 }),
    enabled: open,
    staleTime: 30_000,
  })

  const suppliers =
    (
      data?.data as
        | { data: { id: string; code: string; name: string; taxId?: string | null }[] }
        | undefined
    )?.data ?? []

  function handleSelect(id: string, name: string, code: string) {
    onChange(id)
    setConfirmedLabel(`${name} (${code})`)
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
        className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2 transition-colors ${borderClass}`}
      >
        <Search className="h-4 w-4 shrink-0 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={confirmedLabel || 'Search supplier by name or code…'}
          className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
        />
        {value && (
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
          ) : suppliers.length === 0 ? (
            <p className="px-3 py-3 text-sm text-zinc-400">
              {debouncedQuery
                ? `No suppliers found for "${debouncedQuery}"`
                : 'Type to search suppliers…'}
            </p>
          ) : (
            suppliers.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s.id, s.name, s.code)}
                className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-zinc-50 ${
                  s.id === value
                    ? 'bg-prominent-purple-50 text-prominent-purple-700'
                    : 'text-zinc-800'
                }`}
              >
                <span className="font-medium">{s.name}</span>
                <span className="font-mono text-xs text-zinc-400">{s.code}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
