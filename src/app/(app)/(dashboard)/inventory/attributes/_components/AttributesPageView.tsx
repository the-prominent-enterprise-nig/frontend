'use client'

import { useState } from 'react'
import { Pencil, RefreshCw, Sliders } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import { ListFooterPager } from '@/src/components/inventory/ListFooterPager'
import { MONO, PLEX } from '@/src/libs/design/plex'
import {
  EmptyState,
  ICON_BUTTON,
  ListHeader,
  LoadError,
  PAGE_INNER,
  PAGE_SHELL,
  PRIMARY_BUTTON,
  StatusPill,
  TABLE_HEAD_ROW,
  TableCard,
} from '../../master-data/_components/masterDataChrome'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useAttributes } from '../_hooks/useAttributes'
import AttributeModal from './AttributeModal'
import type {
  AttributeDefinition,
  AttributeDefinitionFormValues,
} from '@/src/schema/inventory/attributes'

function dataTypeBadge(type: string): string {
  const map: Record<string, string> = {
    text: 'bg-[#e8effc] text-[#1f4fa8]',
    number: 'bg-[#e7f5ef] text-[#0b6644]',
    boolean: 'bg-[#f0e9fc] text-[#5b21b6]',
    date: 'bg-[#fdf3e3] text-[#8a5300]',
    dropdown: 'bg-[#e4f5f4] text-[#0e6460]',
    multi_select: 'bg-[#fbeaf3] text-[#9b1c5c]',
  }
  return map[type] ?? 'bg-[#f1f1f4] text-[#4b4b5a]'
}

function AttributeRow({
  attr,
  onEdit,
}: {
  attr: AttributeDefinition
  onEdit?: (attr: AttributeDefinition) => void
}): React.JSX.Element {
  return (
    <tr className="hover:bg-[#fbfbfc]">
      <td className="px-4 py-3 font-medium text-[#1d1d26]">{attr.displayName}</td>
      <td className={`hidden px-4 py-3 ${MONO} text-[12px] text-[#3f1490] sm:table-cell`}>
        {attr.attributeKey}
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-medium capitalize ${dataTypeBadge(attr.dataType)}`}
        >
          {attr.dataType.replace('_', ' ')}
        </span>
      </td>
      <td className="hidden px-4 py-3 text-center md:table-cell">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-medium ${attr.isRequired ? 'bg-[#fdeceb] text-[#b42318]' : 'bg-[#f1f1f4] text-[#4b4b5a]'}`}
        >
          {attr.isRequired ? 'Yes' : 'No'}
        </span>
      </td>
      <td className="hidden px-4 py-3 text-center tabular-nums text-[#3d3d4a] lg:table-cell">
        {attr.displayOrder}
      </td>
      <td className="hidden px-4 py-3 lg:table-cell">
        {attr.status ? <StatusPill status={attr.status} /> : '—'}
      </td>
      {onEdit && (
        <td className="px-4 py-2 text-right">
          <Tooltip label="Edit attribute" align="end">
            <button
              type="button"
              onClick={() => onEdit(attr)}
              aria-label={`Edit ${attr.displayName}`}
              className={ICON_BUTTON}
            >
              <Pencil className="h-4 w-4" />
            </button>
          </Tooltip>
        </td>
      )}
    </tr>
  )
}

function AttributesTable({
  rows,
  onEdit,
}: {
  rows: AttributeDefinition[]
  onEdit?: (attr: AttributeDefinition) => void
}): React.JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead className={TABLE_HEAD_ROW}>
          <tr>
            <th className="px-4 py-2.5">Display Name</th>
            <th className="hidden px-4 py-2.5 sm:table-cell">Key</th>
            <th className="hidden px-4 py-2.5 md:table-cell">Data Type</th>
            <th className="hidden px-4 py-2.5 text-center md:table-cell">Required</th>
            <th className="hidden px-4 py-2.5 text-center lg:table-cell">Order</th>
            <th className="hidden px-4 py-2.5 lg:table-cell">Status</th>
            {onEdit && <th className="w-16 px-4 py-2.5" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eeeef1]">
          {rows.map((attr) => (
            <AttributeRow key={attr.id} attr={attr} onEdit={onEdit} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AttributesPageView({ session }: { session: SessionUser }) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.ATTRIBUTES_MANAGE)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AttributeDefinition | null>(null)

  const {
    attributes,
    pagination,
    isLoading,
    isFetching,
    error,
    page,
    setPage,
    categoryOptions,
    createAttribute,
    isCreating,
    updateAttribute,
    isUpdating,
    refetch,
  } = useAttributes()

  function openCreate() {
    setEditTarget(null)
    setIsModalOpen(true)
  }

  function openEdit(attr: AttributeDefinition) {
    setEditTarget(attr)
    setIsModalOpen(true)
  }

  async function handleSubmit(data: AttributeDefinitionFormValues) {
    if (editTarget) return updateAttribute(editTarget.id, data)
    return createAttribute(data)
  }

  const addButton = canManage && (
    <button type="button" onClick={openCreate} className={PRIMARY_BUTTON}>
      + New Attribute
    </button>
  )

  return (
    <div className={`${PAGE_SHELL} ${PLEX}`}>
      <div className={PAGE_INNER}>
        <ListHeader
          title="Item Attributes"
          description="Create and manage custom attributes for inventory items."
          actions={
            <>
              <Tooltip label="Refresh">
                <button
                  type="button"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  aria-label="Refresh"
                  className={`${ICON_BUTTON} disabled:opacity-50`}
                >
                  <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                </button>
              </Tooltip>
              {addButton}
            </>
          }
        />

        {error && <LoadError message="Failed to load attributes — try refreshing the page." />}

        <TableCard fetching={isFetching && !isLoading}>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-ink-muted">Loading attributes…</div>
          ) : attributes.length === 0 ? (
            <EmptyState
              icon={<Sliders className="h-10 w-10" />}
              title="No attribute definitions yet"
              hint={canManage ? 'Add custom attributes to extend item data.' : undefined}
              action={addButton || undefined}
            />
          ) : (
            <>
              <AttributesTable rows={attributes} onEdit={canManage ? openEdit : undefined} />
              <ListFooterPager
                page={page}
                pageCount={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                noun="attributes"
                onPageChange={setPage}
              />
            </>
          )}
        </TableCard>
      </div>

      <AttributeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
        categories={categoryOptions}
        editTarget={editTarget}
      />
    </div>
  )
}
