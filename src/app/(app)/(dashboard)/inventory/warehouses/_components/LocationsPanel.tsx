'use client'

import { useState } from 'react'
import { Plus, X, MapPin, Package } from 'lucide-react'
import type { WarehouseSummary, LocationSummary } from '@/src/schema/inventory/warehouses'
import type { CreateLocationFormValues } from '@/src/schema/inventory/warehouses'
import type { ApiResponse } from '@/src/libs/api/client'
import CreateLocationModal from './CreateLocationModal'

const LOCATION_TYPE_COLORS: Record<string, string> = {
  shelf: 'bg-blue-100 text-blue-700',
  bin: 'bg-amber-100 text-amber-700',
  zone: 'bg-purple-100 text-purple-700',
  dock: 'bg-zinc-100 text-zinc-600',
}

type Props = {
  warehouse: WarehouseSummary
  locations: LocationSummary[]
  isLoading: boolean
  canUpdate: boolean
  onClose: () => void
  onAddLocation: (
    warehouseId: string,
    data: CreateLocationFormValues
  ) => Promise<ApiResponse<unknown>>
  isAddingLocation: boolean
}

export default function LocationsPanel({
  warehouse,
  locations,
  isLoading,
  canUpdate,
  onClose,
  onAddLocation,
  isAddingLocation,
}: Props) {
  const [isAddOpen, setIsAddOpen] = useState(false)

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-prominent-purple-600" />
              <h3 className="truncate text-base font-semibold text-zinc-900">{warehouse.name}</h3>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">
              {warehouse.code}
              {warehouse.address ? ` · ${warehouse.address}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sub-header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Sub-locations ({locations.length})
          </span>
          {canUpdate && (
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-prominent-purple-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MapPin className="mb-2 h-8 w-8 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No sub-locations yet</p>
              {canUpdate && (
                <p className="mt-1 text-xs text-zinc-400">
                  Click &ldquo;Add&rdquo; to create the first storage location.
                </p>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {locations.map((loc) => {
                const stockCount = loc._count?.stockBalances ?? 0
                return (
                  <li key={loc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-zinc-700">
                          {loc.code}
                        </span>
                        {loc.locationType && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${LOCATION_TYPE_COLORS[loc.locationType] ?? LOCATION_TYPE_COLORS.shelf}`}
                          >
                            {loc.locationType}
                          </span>
                        )}
                      </div>
                      {loc.name && (
                        <p className="mt-0.5 truncate text-xs text-zinc-500">{loc.name}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-xs text-zinc-400">
                      <Package className="h-3.5 w-3.5" />
                      <span>
                        {stockCount} item{stockCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <CreateLocationModal
        isOpen={isAddOpen}
        warehouse={warehouse}
        onClose={() => setIsAddOpen(false)}
        onSubmit={(data) => onAddLocation(warehouse.id, data)}
        isSubmitting={isAddingLocation}
      />
    </>
  )
}
