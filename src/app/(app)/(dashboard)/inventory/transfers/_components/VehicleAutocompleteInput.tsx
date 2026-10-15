'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Loader2 } from 'lucide-react'
import type { VehicleSummary } from '@/src/schema/inventory/vehicles'

type Props = {
  value: string
  onChange: (value: string) => void
  /** Fired when the user picks a roster entry. The caller takes only the
   * field this input is for — picking a driver never fills the plate, nor
   * the reverse (Scenario 71 item 22). */
  onPickVehicle: (vehicle: VehicleSummary) => void
  /** What the dropdown lists: plate numbers (default), or the roster's
   * distinct driver names. */
  mode?: 'plate' | 'driver'
  search: (query: string) => Promise<VehicleSummary[]>
  queryKey: string
  placeholder?: string
  error?: string
  disabled?: boolean
}

/**
 * Unlike SearchCombobox (which only ever commits a picked option's id),
 * driverName/vehiclePlate are free-text per-transfer fields — the client's
 * fleet roster (Vehicle model) doesn't cover every ad hoc carrier, so
 * typing something not on the roster must still just work. This is a plain
 * text input with a debounced dropdown of matching roster vehicles;
 * picking one autofills via onPickVehicle instead of locking the field.
 */
export function VehicleAutocompleteInput({
  value,
  onChange,
  onPickVehicle,
  search,
  queryKey,
  placeholder,
  error,
  disabled,
  mode = 'plate',
}: Props) {
  const [open, setOpen] = useState(false)
  const [debouncedQuery, setDebouncedQuery] = useState(value)
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(value), 300)
    return () => clearTimeout(t)
  }, [value])

  const updatePosition = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width })
  }, [])

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

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (!containerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false)
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

  const options = mode === 'driver' ? distinctDrivers(data ?? [], value) : (data ?? [])

  function handlePick(vehicle: VehicleSummary) {
    onPickVehicle(vehicle)
    setOpen(false)
  }

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
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => !disabled && setOpen(true)}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed"
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {open &&
        position &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ top: position.top, left: position.left, width: position.width }}
            className="fixed z-100 max-h-56 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              </div>
            ) : options.length === 0 ? (
              <p className="px-3 py-3 text-sm text-zinc-400">
                {value.trim()
                  ? `No matching ${mode === 'driver' ? 'drivers' : 'vehicles'} for "${value.trim()}"`
                  : mode === 'driver'
                    ? 'No drivers on file'
                    : 'No vehicles on file'}
              </p>
            ) : (
              options.map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => handlePick(vehicle)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm text-zinc-800 transition-colors hover:bg-zinc-50"
                >
                  {mode === 'driver' ? (
                    <span className="w-full truncate font-medium">{vehicle.driverName}</span>
                  ) : (
                    <>
                      <span className="w-full truncate font-mono font-medium">
                        {vehicle.plateNo}
                      </span>
                      {vehicle.tag && (
                        <span className="w-full truncate text-xs text-zinc-400">{vehicle.tag}</span>
                      )}
                    </>
                  )}
                </button>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  )
}

/** One entry per driver name. The search also matches plates, so a typed
 * query is re-applied to the name itself — a driver list shouldn't offer
 * someone whose plate happened to match. */
function distinctDrivers(vehicles: VehicleSummary[], query: string): VehicleSummary[] {
  const q = query.trim().toLowerCase()
  const seen = new Set<string>()
  return vehicles.filter((v) => {
    const name = v.driverName?.trim()
    if (!name || (q && !name.toLowerCase().includes(q))) return false
    const key = name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
