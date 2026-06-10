'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { api } from '@/src/libs/api/client'

type Option = { id: string; primary: string; secondary?: string }

interface EntityPickerProps {
  /** Current selected UUID */
  value: string
  /** Called with the selected UUID (or empty string when cleared) */
  onChange: (id: string, option?: Option) => void
  /** Placeholder when empty */
  placeholder?: string
  /** Optional pre-set label (used to show selected value without re-fetching) */
  initialLabel?: string
  /** Fetcher: given a search query, return an array of options */
  fetcher: (query: string) => Promise<Option[]>
  /** Smaller variant for inline use */
  compact?: boolean
}

/**
 * Generic search-and-pick combo for entity references. Debounces typing,
 * keeps the selected option's display label even after closing the dropdown.
 */
export default function EntityPicker({
  value,
  onChange,
  placeholder = 'Search…',
  initialLabel,
  fetcher,
  compact = false,
}: EntityPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState(initialLabel ?? '')
  const wrapRef = useRef<HTMLDivElement>(null)

  // Debounced search
  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      setLoading(true)
      const result = await fetcher(query)
      setOptions(result)
      setLoading(false)
    }, 200)
    return () => clearTimeout(t)
  }, [query, open, fetcher])

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function select(opt: Option) {
    onChange(opt.id, opt)
    setSelectedLabel(opt.primary + (opt.secondary ? ` — ${opt.secondary}` : ''))
    setOpen(false)
    setQuery('')
  }

  function clear() {
    onChange('')
    setSelectedLabel('')
    setQuery('')
  }

  const padding = compact ? 'py-1 px-2' : 'py-2 px-3'

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white text-left text-[13px] hover:border-gray-300 ${padding}`}
      >
        <span className={selectedLabel ? 'text-gray-900' : 'text-gray-400'}>
          {selectedLabel || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                clear()
              }}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="relative border-b border-gray-100">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search…"
              className="w-full bg-transparent py-2 pl-8 pr-2 text-[13px] placeholder:text-gray-400 focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {loading && (
              <div className="px-3 py-3 text-center text-[12px] text-gray-400">Searching…</div>
            )}
            {!loading && options.length === 0 && (
              <div className="px-3 py-3 text-center text-[12px] text-gray-400">
                {query ? 'No matches' : 'Type to search'}
              </div>
            )}
            {!loading &&
              options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => select(opt)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-prominent-orange-50/40"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-gray-900">{opt.primary}</div>
                    {opt.secondary && (
                      <div className="truncate text-[12px] text-gray-500">{opt.secondary}</div>
                    )}
                  </div>
                  {value === opt.id && <Check className="h-4 w-4 text-emerald-600" />}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Concrete pickers ───────────────────────────────────────────────────────

type ItemRow = { id: string; sku: string; name: string }
type ListResp<T> = { data: T[] }

export function ItemPicker(props: Omit<EntityPickerProps, 'fetcher'>) {
  return (
    <EntityPicker
      {...props}
      placeholder={props.placeholder ?? 'Pick an item…'}
      fetcher={async (q) => {
        const res = await api.get<ListResp<ItemRow>>('/inventory/items', {
          search: q,
          limit: 20,
        })
        if (!res.success || !res.data) return []
        return res.data.data.map((i) => ({
          id: i.id,
          primary: i.name,
          secondary: i.sku,
        }))
      }}
    />
  )
}

type SupplierRow = { id: string; code: string; name: string }

export function SupplierPicker(props: Omit<EntityPickerProps, 'fetcher'>) {
  return (
    <EntityPicker
      {...props}
      placeholder={props.placeholder ?? 'Pick a supplier…'}
      fetcher={async (q) => {
        const res = await api.get<ListResp<SupplierRow>>('/suppliers', {
          search: q,
          limit: 20,
        })
        if (!res.success || !res.data) return []
        return res.data.data.map((s) => ({
          id: s.id,
          primary: s.name,
          secondary: s.code,
        }))
      }}
    />
  )
}

type WarehouseRow = { id: string; code: string; name: string }

export function WarehousePicker(props: Omit<EntityPickerProps, 'fetcher'>) {
  return (
    <EntityPicker
      {...props}
      placeholder={props.placeholder ?? 'Pick a warehouse…'}
      fetcher={async (q) => {
        const res = await api.get<ListResp<WarehouseRow>>('/inventory/warehouses', {
          search: q,
          limit: 20,
        })
        if (!res.success || !res.data) return []
        return res.data.data.map((w) => ({
          id: w.id,
          primary: w.name,
          secondary: w.code,
        }))
      }}
    />
  )
}
