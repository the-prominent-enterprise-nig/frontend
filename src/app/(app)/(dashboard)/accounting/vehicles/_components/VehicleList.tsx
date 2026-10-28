'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Car, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { RowActionsMenu, type RowMenuItem } from '@/src/components/ui/RowActionsMenu'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { showToast } from '@/src/components/ui/toast'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { VehicleCategory } from '@/src/schema/inventory/vehicles'
import { getVehicles } from '../_actions/get-vehicles'
import { deleteVehicle } from '../_actions/delete-vehicle'
import { getBranches } from '../../drivers/_actions/get-branches'
import { CATEGORY_LABELS } from './vehicle-labels'

const PAGE_SIZE = 25

const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500'

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABELS) as VehicleCategory[]).map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
}))

export function VehicleList({ session }: { session: SessionUser }) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [branchId, setBranchId] = useState('')
  const [category, setCategory] = useState<VehicleCategory | ''>('')
  const [page, setPage] = useState(1)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const router = useRouter()
  const queryClient = useQueryClient()
  // The roster is managed with the same permissions as the Drivers list.
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.DRIVERS_CREATE)
  const canUpdate = hasPermission(session, INVENTORY_PERMISSIONS.DRIVERS_UPDATE)
  const canDelete = hasPermission(session, INVENTORY_PERMISSIONS.DRIVERS_DELETE)
  const showActions = canUpdate || canDelete

  // A branch-assigned user is scoped to their own branch by the server, so
  // the branch picker is only useful for head-office / all-branch users.
  const branchLocked = Boolean(session.branchId)

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const branchesQuery = useQuery({
    queryKey: ['inventory-drivers-branches'],
    queryFn: () => getBranches(),
    enabled: !branchLocked,
    staleTime: 10 * 60 * 1000,
  })
  const branches = branchesQuery.data?.data?.data ?? []

  const params = {
    q: search || undefined,
    branchId: branchId || undefined,
    category: category || undefined,
    page,
    limit: PAGE_SIZE,
  }
  const vehiclesQuery = useQuery({
    queryKey: ['inventory-vehicles', params],
    queryFn: () => getVehicles(params),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: (res) => {
      setConfirmingId(null)
      if (res.success) {
        showToast({ title: 'Vehicle deleted', status: 'success' })
        queryClient.invalidateQueries({ queryKey: ['inventory-vehicles'] })
      } else {
        showToast({
          title: 'Could not delete vehicle',
          description: res.message ?? res.error,
          status: 'error',
        })
      }
    },
  })

  const rowMenuItems = (id: string): RowMenuItem[] => [
    ...(canUpdate
      ? [
          {
            label: 'Edit',
            icon: Pencil,
            onClick: () => router.push(`/accounting/vehicles/${id}/edit`),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            label: 'Delete',
            icon: Trash2,
            variant: 'danger' as const,
            onClick: () => setConfirmingId(id),
          },
        ]
      : []),
  ]

  const payload = vehiclesQuery.data?.data
  const vehicles = payload?.data ?? []
  const total = payload?.meta.total ?? 0
  const lastPage = payload?.meta.lastPage ?? 1
  const hasFilters = Boolean(searchInput || branchId || category)
  const loadFailed = vehiclesQuery.data ? !vehiclesQuery.data.success : Boolean(vehiclesQuery.error)

  return (
    <div className="w-full min-h-full bg-zinc-50 p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[21px] font-semibold tracking-[-0.015em] text-prominent-purple-900">
              Vehicles
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              The fleet roster by plate number. Open a vehicle to see the fuel and repair expenses
              recorded against it.
            </p>
          </div>
          {canCreate && (
            <Link
              href="/accounting/vehicles/new"
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
            >
              <Plus className="h-4 w-4" />
              Add Vehicle
            </Link>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by plate number or vehicle type…"
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
            />
          </div>
          {!branchLocked && (
            <div className="w-full sm:w-56">
              <SearchableSelect
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                value={branchId}
                onChange={(v) => {
                  setBranchId(v)
                  setPage(1)
                }}
                placeholder="All Branches"
                loading={branchesQuery.isLoading}
                clearable
                ariaLabel="Branch"
              />
            </div>
          )}
          <div className="w-full sm:w-48">
            <SearchableSelect
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={(v) => {
                setCategory(v as VehicleCategory | '')
                setPage(1)
              }}
              placeholder="All Categories"
              clearable
              ariaLabel="Category"
            />
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                setSearch('')
                setBranchId('')
                setCategory('')
                setPage(1)
              }}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>

        {loadFailed && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Failed to load vehicles</p>
            <p className="mt-1 text-xs text-red-600">Please try refreshing the page.</p>
          </div>
        )}

        <div
          className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${vehiclesQuery.isFetching ? 'opacity-60' : ''}`}
        >
          {vehiclesQuery.isLoading ? (
            <div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-zinc-100 px-6 py-4 last:border-0"
                >
                  <div className="h-4 w-48 animate-pulse rounded bg-zinc-200" />
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                  <div className="ml-auto h-4 w-20 animate-pulse rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ) : vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Car className="mb-3 h-10 w-10 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No vehicles found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="vehicle-list-table">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className={TH}>Plate No.</th>
                    <th className={TH}>Vehicle Type</th>
                    <th className={TH}>Category</th>
                    <th className={TH}>Branch</th>
                    {showActions && <th className={`${TH} w-12`} aria-label="Row actions" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {vehicles.map((v) => (
                    <tr
                      key={v.id}
                      data-testid="vehicle-row"
                      onClick={() => router.push(`/accounting/vehicles/${v.id}`)}
                      className="cursor-pointer hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/accounting/vehicles/${v.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs font-semibold text-prominent-purple-800 hover:underline"
                        >
                          {v.plateNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{v.tag ?? '—'}</td>
                      <td className="px-4 py-3 text-zinc-600">{CATEGORY_LABELS[v.category]}</td>
                      <td className="px-4 py-3 text-zinc-600">{v.branch?.name ?? '—'}</td>
                      {showActions && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {confirmingId === v.id ? (
                              <>
                                <span className="mr-1 text-xs text-zinc-500">
                                  Delete this vehicle?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => deleteMutation.mutate(v.id)}
                                  disabled={deleteMutation.isPending}
                                  className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmingId(null)}
                                  className="rounded-lg px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <RowActionsMenu horizontal items={rowMenuItems(v.id)} />
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > 0 && (
            <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-xs text-zinc-500">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}{' '}
                vehicles
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-zinc-500">
                  {page} / {lastPage}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  disabled={page >= lastPage}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
