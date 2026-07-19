'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { accountingCustomersApi } from '@/src/libs/api/crm'
import type { AccountingCustomerLite } from '@/src/schema/crm/types'

function fullName(c: AccountingCustomerLite): string {
  return [c.firstName, c.lastName].filter(Boolean).join(' ')
}

export default function CustomerPicker({
  value,
  selectedLabel,
  onChange,
  error,
}: {
  value: string
  selectedLabel?: string
  onChange: (customerId: string, label: string) => void
  error?: string
}) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<AccountingCustomerLite[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  const searchActive = open && search.trim().length >= 2

  useEffect(() => {
    if (!searchActive) return
    const controller = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      const res = await accountingCustomersApi.search(search)
      if (controller.signal.aborted) return
      if (res.success && res.data) setResults(res.data.slice(0, 20))
      setLoading(false)
    }, 250)
    return () => {
      controller.abort()
      clearTimeout(t)
    }
  }, [search, searchActive])

  const visibleResults = searchActive ? results : []

  if (value && selectedLabel && !open) {
    return (
      <div className="mt-1 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <span className="truncate text-sm text-gray-900">{selectedLabel}</span>
        <button
          type="button"
          onClick={() => {
            onChange('', '')
            setSearch('')
            setOpen(true)
          }}
          className="ml-2 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
          aria-label="Change customer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative mt-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search customer by name, email, or phone…"
          className={`w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm focus:outline-none ${
            error ? 'border-red-300' : 'border-gray-200 focus:border-prominent-orange-400'
          }`}
        />
      </div>
      {error && <p className="mt-1 text-[12px] text-red-600">{error}</p>}

      {searchActive && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {loading && <p className="px-3 py-2 text-[13px] text-gray-400">Searching…</p>}
          {!loading && visibleResults.length === 0 && (
            <p className="px-3 py-2 text-[13px] text-gray-400">No customers found.</p>
          )}
          {!loading &&
            visibleResults.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.id, fullName(c))
                  setOpen(false)
                }}
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{fullName(c)}</span>
                <span className="text-[12px] text-gray-500">{c.email || c.phoneNumber || '—'}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
