'use client'

import { useState, type ReactNode } from 'react'
import { MapPin, Pencil, Search, Warehouse } from 'lucide-react'
import { useWarehouseManager } from '../_hooks/useWarehouseManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { MONO, PLEX } from '@/src/libs/design/plex'
import Tooltip from '@/src/components/ui/Tooltip'
import { ListFooterPager } from '@/src/components/inventory/ListFooterPager'
import type { WarehouseSummary, UpdateWarehouseFormValues } from '@/src/schema/inventory/warehouses'
import {
  EmptyState,
  ICON_BUTTON,
  ListHeader,
  ListSearch,
  LoadError,
  PAGE_INNER,
  PAGE_SHELL,
  PRIMARY_BUTTON,
  StatusPill,
  TABLE_HEAD_ROW,
  TableCard,
} from '../../master-data/_components/masterDataChrome'
import CreateWarehouseModal from './CreateWarehouseModal'
import EditWarehouseModal from './EditWarehouseModal'
import LocationsPanel from './LocationsPanel'

function WarehouseRow({
  wh,
  isSelected,
  onToggle,
  onEdit,
}: {
  wh: WarehouseSummary
  isSelected: boolean
  onToggle: () => void
  onEdit?: () => void
}): ReactNode {
  return (
    <tr
      onClick={onToggle}
      className={`cursor-pointer ${isSelected ? 'bg-[#f6f2fd]' : 'hover:bg-[#fbfbfc]'}`}
    >
      <td className={`px-4 py-3 ${MONO} font-medium text-[#3f1490]`}>{wh.code}</td>
      <td className="px-4 py-3 font-medium text-[#1d1d26]">{wh.name}</td>
      <td className="hidden max-w-[260px] truncate px-4 py-3 text-[#3d3d4a] md:table-cell">
        {wh.address ?? '—'}
      </td>
      <td className="px-4 py-3">
        <StatusPill status={wh.status ?? 'active'} />
      </td>
      <td className="px-4 py-3 text-right">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium tabular-nums ${isSelected ? 'bg-[#5b21b6] text-white' : 'bg-[#f1f1f4] text-[#3d3d4a]'}`}
        >
          <MapPin className="h-3 w-3" />
          {wh._count?.locations ?? 0}
        </span>
      </td>
      <td className="px-4 py-2 text-right">
        {onEdit && (
          <Tooltip label="Edit warehouse" align="end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              aria-label={`Edit ${wh.name}`}
              className={ICON_BUTTON}
            >
              <Pencil className="h-4 w-4" />
            </button>
          </Tooltip>
        )}
      </td>
    </tr>
  )
}

function WarehouseTable({
  rows,
  selectedId,
  onToggle,
  onEdit,
}: {
  rows: WarehouseSummary[]
  selectedId: string | undefined
  onToggle: (wh: WarehouseSummary) => void
  onEdit?: (wh: WarehouseSummary) => void
}): ReactNode {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className={TABLE_HEAD_ROW}>
          <tr>
            <th className="px-4 py-2.5">Code</th>
            <th className="px-4 py-2.5">Name</th>
            <th className="hidden px-4 py-2.5 md:table-cell">Address</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5 text-right">Locations</th>
            <th className="w-16 px-4 py-2.5" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eeeef1]">
          {rows.map((wh) => (
            <WarehouseRow
              key={wh.id}
              wh={wh}
              isSelected={selectedId === wh.id}
              onToggle={() => onToggle(wh)}
              onEdit={onEdit ? () => onEdit(wh) : undefined}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function WarehouseList({ session }: { session: SessionUser }): ReactNode {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.WAREHOUSES_CREATE)
  const canUpdate = hasPermission(session, INVENTORY_PERMISSIONS.WAREHOUSES_UPDATE)
  const wm = useWarehouseManager()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<WarehouseSummary | null>(null)
  const filtered = !!wm.search
  const selected = wm.selectedWarehouse

  const addButton = canCreate && (
    <button type="button" onClick={() => setIsCreateOpen(true)} className={PRIMARY_BUTTON}>
      + Add Warehouse
    </button>
  )

  return (
    <div className={`${PAGE_SHELL} ${PLEX}`}>
      <div className={PAGE_INNER}>
        <ListHeader
          title="Warehouses"
          description="Physical storage locations and their sub-locations, for accurate stock tracking."
          actions={addButton || undefined}
        />

        <div className="flex flex-wrap items-center gap-2">
          <ListSearch
            value={wm.search}
            onChange={wm.setSearch}
            placeholder="Search by name or code…"
          />
        </div>

        {wm.error && <LoadError message="Failed to load warehouses — try refreshing the page." />}

        <div className={`grid gap-4 ${selected ? 'lg:grid-cols-[1fr_360px]' : 'grid-cols-1'}`}>
          <TableCard fetching={wm.isFetching && !wm.isLoading}>
            {wm.isLoading ? (
              <div className="p-8 text-center text-sm text-ink-muted">Loading warehouses…</div>
            ) : wm.warehouses.length === 0 ? (
              <EmptyState
                icon={
                  filtered ? <Search className="h-8 w-8" /> : <Warehouse className="h-10 w-10" />
                }
                title={filtered ? 'No warehouses match' : 'No warehouses yet'}
                hint={filtered ? undefined : 'Create your first warehouse to get started.'}
                action={!filtered ? addButton : undefined}
              />
            ) : (
              <>
                <WarehouseTable
                  rows={wm.warehouses}
                  selectedId={selected?.id}
                  onToggle={(wh) => wm.setSelectedWarehouse(selected?.id === wh.id ? null : wh)}
                  onEdit={canUpdate ? setEditTarget : undefined}
                />
                <ListFooterPager
                  page={wm.page}
                  pageCount={wm.pagination.totalPages}
                  total={wm.pagination.total}
                  limit={wm.pagination.limit}
                  noun="warehouses"
                  onPageChange={wm.setPage}
                />
              </>
            )}
          </TableCard>

          {selected && (
            <div className="h-fit lg:sticky lg:top-6">
              <LocationsPanel
                warehouse={selected}
                locations={wm.locations}
                isLoading={wm.isLoadingLocations}
                canUpdate={canUpdate}
                onClose={() => wm.setSelectedWarehouse(null)}
                onAddLocation={wm.addLocation}
                isAddingLocation={wm.isAddingLocation}
              />
            </div>
          )}
        </div>
      </div>

      <CreateWarehouseModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={wm.createWarehouse}
        isSubmitting={wm.isCreating}
      />

      <EditWarehouseModal
        isOpen={!!editTarget}
        warehouse={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={(data: UpdateWarehouseFormValues) => wm.updateWarehouse(editTarget!.id, data)}
        isSubmitting={wm.isUpdating}
      />
    </div>
  )
}
