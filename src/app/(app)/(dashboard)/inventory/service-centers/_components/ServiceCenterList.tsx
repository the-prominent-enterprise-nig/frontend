'use client'

import { useState, type ReactNode } from 'react'
import { Pencil, Plus, RefreshCw, Search, Wrench } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import { StatusBadge } from '@/src/components/ui/StatusBadge'
import { canAny, type SessionUser } from '@/src/libs/guards/permission'
import { SUPPLIER_ACCESS } from '@/src/libs/guards/shared-ownership'
import type { SupplierListItem } from '@/src/schema/inventory/suppliers'
import { STATUS_META } from '../../../accounting/suppliers/_lib/supplier-format'
import { useServiceCenters } from '../_hooks/useServiceCenters'
import { ServiceCenterFormModal } from './ServiceCenterFormModal'

const TH = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-ink-subtle'

/** undefined = closed, null = adding, a row = editing that row. */
type ModalTarget = SupplierListItem | null | undefined

function SkeletonRows(): ReactNode {
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i}>
      <td colSpan={4} className="px-4 py-4">
        <div className="h-4 w-full animate-pulse rounded bg-zinc-200" />
      </td>
    </tr>
  ))
}

function EmptyRow({ searching }: { searching: boolean }): ReactNode {
  return (
    <tr>
      <td colSpan={4} className="py-16 text-center">
        <Wrench className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
        <p className="text-sm font-medium text-ink-muted">
          {searching ? 'No service centers match your search' : 'No service centers yet'}
        </p>
      </td>
    </tr>
  )
}

function ServiceCenterRow({
  sc,
  onEdit,
}: {
  sc: SupplierListItem
  onEdit?: () => void
}): ReactNode {
  const meta = STATUS_META[sc.status]
  return (
    <tr className="hover:bg-zinc-50">
      <td className="px-4 py-3 font-medium text-zinc-900">{sc.name}</td>
      <td className="px-4 py-3 text-ink-muted">{sc.address || '—'}</td>
      <td className="px-4 py-3">
        <StatusBadge label={meta.label} colorClassName={meta.chip} dotClassName={meta.dot} />
      </td>
      <td className="px-4 py-3 text-right">
        {onEdit && (
          <Tooltip label="Edit service center" align="end">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit ${sc.name}`}
              className="rounded p-1.5 text-ink-faint hover:bg-zinc-100 hover:text-prominent-purple-700"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
      </td>
    </tr>
  )
}

export function ServiceCenterList({ session }: { session: SessionUser }): ReactNode {
  const canCreate = canAny(session, SUPPLIER_ACCESS.CREATE)
  const canUpdate = canAny(session, SUPPLIER_ACCESS.UPDATE)
  const sc = useServiceCenters()
  const [target, setTarget] = useState<ModalTarget>(undefined)

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-[14px] min-[1080px]:px-5 min-[1080px]:py-[22px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-semibold tracking-[-0.015em]">Service Centers</h1>
          <p className="mt-1 text-sm text-ink-subtle">
            Repair providers offered when a unit is sent out for repair.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => sc.refetch()}
            disabled={sc.isFetching}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-prominent-purple-700 hover:bg-prominent-purple-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${sc.isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => setTarget(null)}
              className="flex items-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800"
            >
              <Plus className="h-4 w-4" />
              Add Service Center
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          value={sc.search}
          onChange={(e) => sc.setSearch(e.target.value)}
          placeholder="Search by name or address…"
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-ink-faint focus:border-prominent-purple-500 focus:ring-1 focus:ring-prominent-purple-500"
        />
      </div>

      {sc.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">Failed to load service centers</p>
          <p className="mt-1 text-xs text-red-600">{sc.error}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className={TH}>Name</th>
              <th className={TH}>Address</th>
              <th className={TH}>Status</th>
              <th className={`${TH} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sc.isLoading ? (
              <SkeletonRows />
            ) : sc.serviceCenters.length === 0 ? (
              <EmptyRow searching={!!sc.search.trim()} />
            ) : (
              sc.serviceCenters.map((row) => (
                <ServiceCenterRow
                  key={row.id}
                  sc={row}
                  onEdit={canUpdate ? () => setTarget(row) : undefined}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <ServiceCenterFormModal
        open={target !== undefined}
        target={target ?? null}
        onClose={() => setTarget(undefined)}
        onSubmit={(values) => sc.saveServiceCenter({ id: target?.id ?? null, values })}
        isSubmitting={sc.isSaving}
      />
    </div>
  )
}
