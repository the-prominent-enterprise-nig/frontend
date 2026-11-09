'use client'

import { useState, type ReactNode } from 'react'
import { Pencil, Search, Wrench } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import { PLEX } from '@/src/libs/design/plex'
import { canAny, type SessionUser } from '@/src/libs/guards/permission'
import { SUPPLIER_ACCESS } from '@/src/libs/guards/shared-ownership'
import type { SupplierListItem } from '@/src/schema/inventory/suppliers'
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
import { useServiceCenters } from '../_hooks/useServiceCenters'
import { ServiceCenterFormModal } from './ServiceCenterFormModal'

/** undefined = closed, null = adding, a row = editing that row. */
type ModalTarget = SupplierListItem | null | undefined

function ServiceCenterTable({
  rows,
  onEdit,
}: {
  rows: SupplierListItem[]
  onEdit?: (row: SupplierListItem) => void
}): ReactNode {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[13px]">
        <thead className={TABLE_HEAD_ROW}>
          <tr>
            <th className="px-4 py-2.5">Name</th>
            <th className="px-4 py-2.5">Address</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="w-16 px-4 py-2.5" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eeeef1]">
          {rows.map((sc) => (
            <tr key={sc.id} className="hover:bg-[#fbfbfc]">
              <td className="px-4 py-3 font-medium text-[#1d1d26]">{sc.name}</td>
              <td className="px-4 py-3 text-[#3d3d4a]">{sc.address || '—'}</td>
              <td className="px-4 py-3">
                <StatusPill status={sc.status} />
              </td>
              <td className="px-4 py-2 text-right">
                {onEdit && (
                  <Tooltip label="Edit service center" align="end">
                    <button
                      type="button"
                      onClick={() => onEdit(sc)}
                      aria-label={`Edit ${sc.name}`}
                      className={ICON_BUTTON}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </Tooltip>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ServiceCenterList({ session }: { session: SessionUser }): ReactNode {
  const canCreate = canAny(session, SUPPLIER_ACCESS.CREATE)
  const canUpdate = canAny(session, SUPPLIER_ACCESS.UPDATE)
  const sc = useServiceCenters()
  const [target, setTarget] = useState<ModalTarget>(undefined)
  const filtered = !!sc.search.trim()

  const addButton = canCreate && (
    <button type="button" onClick={() => setTarget(null)} className={PRIMARY_BUTTON}>
      + Add Service Center
    </button>
  )

  return (
    <div className={`${PAGE_SHELL} ${PLEX}`}>
      <div className={PAGE_INNER}>
        <ListHeader
          title="Service Centers"
          description="Repair providers offered when a unit is sent out for repair."
          actions={addButton || undefined}
        />

        <div className="flex flex-wrap items-center gap-2">
          <ListSearch
            value={sc.search}
            onChange={sc.setSearch}
            placeholder="Search by name or address…"
          />
        </div>

        {sc.error && <LoadError message={`Failed to load service centers — ${sc.error}`} />}

        <TableCard fetching={sc.isFetching && !sc.isLoading}>
          {sc.isLoading ? (
            <div className="p-8 text-center text-sm text-ink-muted">Loading service centers…</div>
          ) : sc.serviceCenters.length === 0 ? (
            <EmptyState
              icon={filtered ? <Search className="h-8 w-8" /> : <Wrench className="h-10 w-10" />}
              title={filtered ? 'No service centers match' : 'No service centers yet'}
              hint={
                filtered
                  ? undefined
                  : 'Add the shops and technicians units are sent to for repair — they appear wherever a repair provider is picked.'
              }
              action={!filtered ? addButton : undefined}
            />
          ) : (
            <ServiceCenterTable
              rows={sc.serviceCenters}
              onEdit={canUpdate ? setTarget : undefined}
            />
          )}
        </TableCard>
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
