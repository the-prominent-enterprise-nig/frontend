'use client'

import { useState } from 'react'
import { RefreshCw, Search, X, Pencil, Ruler } from 'lucide-react'
import Tooltip from '@/src/components/ui/Tooltip'
import { ListFooterPager } from '@/src/components/inventory/ListFooterPager'
import { MONO, PLEX, STOCK_TABLE_HEAD } from '@/src/libs/design/plex'
import {
  EmptyState,
  ICON_BUTTON,
  ListHeader,
  ListSearch,
  LoadError,
  PAGE_INNER,
  PAGE_SHELL,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  TABLE_HEAD_ROW,
  TableCard,
} from '../../master-data/_components/masterDataChrome'
import { useUomManager } from '../_hooks/useUomManager'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import UomFormModal from './UomFormModal'
import type { CreateUomFormValues, UomRecord } from '@/src/schema/inventory/uom'

const CODE_CELL = `${MONO} font-medium text-[#3f1490]`

function UomRow({
  uom,
  onEdit,
}: {
  uom: UomRecord
  onEdit?: (uom: UomRecord) => void
}): React.JSX.Element {
  const isBase = uom.isBaseUnit === true
  const factor = uom.conversionFactor
  const baseCode = uom.baseUnit?.code
  return (
    <tr className="hover:bg-[#fbfbfc]">
      <td className={`px-4 py-3 ${CODE_CELL}`}>{uom.code}</td>
      <td className="px-4 py-3 font-medium text-[#1d1d26]">{uom.name}</td>
      <td className="px-4 py-3 text-center">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-medium ${isBase ? 'bg-[#f0e9fc] text-[#5b21b6]' : 'bg-[#f1f1f4] text-[#4b4b5a]'}`}
        >
          {isBase ? 'Base' : 'Alternate'}
        </span>
      </td>
      <td className={`px-4 py-3 ${MONO} text-[12px] text-[#3d3d4a]`}>
        {isBase ? '—' : (baseCode ?? uom.baseUnitId ?? '—')}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {isBase ? (
          <span className="text-ink-faint">1</span>
        ) : factor != null ? (
          <span className="font-medium text-[#1d1d26]">{factor}×</span>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right text-[12px] text-ink-muted">
        {!isBase && factor != null && baseCode
          ? `1 ${uom.code} = ${factor} ${baseCode}`
          : isBase
            ? 'reference'
            : '—'}
      </td>
      {onEdit && (
        <td className="px-4 py-2 text-right">
          <Tooltip label="Edit unit" align="end">
            <button
              type="button"
              onClick={() => onEdit(uom)}
              aria-label={`Edit ${uom.name}`}
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

function UomTable({
  rows,
  onEdit,
}: {
  rows: UomRecord[]
  onEdit?: (uom: UomRecord) => void
}): React.JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead className={TABLE_HEAD_ROW}>
          <tr>
            <th className="px-4 py-2.5">Code</th>
            <th className="px-4 py-2.5">Name</th>
            <th className="px-4 py-2.5 text-center">Type</th>
            <th className="px-4 py-2.5">Base Unit</th>
            <th className="px-4 py-2.5 text-right">Conversion Factor</th>
            <th className="px-4 py-2.5 text-right">Example</th>
            {onEdit && <th className="w-16 px-4 py-2.5" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eeeef1]">
          {rows.map((uom) => (
            <UomRow key={uom.id} uom={uom} onEdit={onEdit} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** When receiving in an alternate unit, multiply by the factor; when selling,
 * divide base-unit stock by it. */
function ConversionReference({ uoms }: { uoms: UomRecord[] }): React.ReactNode {
  const alternates = uoms.filter((u) => !u.isBaseUnit && u.conversionFactor != null && u.baseUnit)
  if (alternates.length === 0) return null
  return (
    <div className="rounded-xl border border-[#e4e4e9] bg-white p-5 shadow-sm">
      <h3 className={`mb-2 ${STOCK_TABLE_HEAD}`}>Conversion Reference</h3>
      <p className="mb-3 text-[12px] leading-relaxed text-[#4b4b5a]">
        When receiving in an alternate unit, multiply quantity by the conversion factor to get
        base-unit stock. When selling in an alternate unit, divide base-unit stock by the factor to
        get available selling units.
      </p>
      <div className="flex flex-wrap gap-2">
        {alternates.map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-2 rounded-lg border border-[#e4e4e9] bg-[#fbfbfc] px-3 py-2 text-[12px]"
          >
            <span className={CODE_CELL}>{u.code}</span>
            <span className="text-ink-faint">=</span>
            <span className="font-medium tabular-nums text-[#5b21b6]">{u.conversionFactor}×</span>
            <span className={`${MONO} text-[#3d3d4a]`}>{u.baseUnit!.code}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function UomList({ session }: { session: SessionUser }) {
  const canCreate = hasPermission(session, INVENTORY_PERMISSIONS.UOM_CREATE)
  const canUpdate = hasPermission(session, INVENTORY_PERMISSIONS.UOM_UPDATE)

  const {
    uoms,
    pagination,
    isLoading,
    isFetching,
    error,
    search,
    setSearch,
    page,
    setPage,
    baseUnits,
    editTarget,
    setEditTarget,
    createUom,
    isCreating,
    updateUom,
    isUpdating,
    refetch,
  } = useUomManager()

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput)
  }

  async function handleSubmit(data: CreateUomFormValues) {
    if (editTarget) {
      return updateUom(editTarget.id, data)
    }
    return createUom(data)
  }

  function openCreate(): void {
    setEditTarget(null)
    setIsCreateOpen(true)
  }

  function openEdit(uom: UomRecord): void {
    setEditTarget(uom)
    setIsCreateOpen(true)
  }

  const addButton = canCreate && (
    <button type="button" onClick={openCreate} className={PRIMARY_BUTTON}>
      + New Unit
    </button>
  )

  return (
    <div className={`${PAGE_SHELL} ${PLEX}`}>
      <div className={PAGE_INNER}>
        <ListHeader
          title="Units of Measure"
          description="Define units and conversion factors for purchasing and selling."
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

        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2">
          <ListSearch
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search by code or name…"
          />
          <button type="submit" className={SECONDARY_BUTTON}>
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('')
                setSearch('')
              }}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] text-ink-muted hover:bg-[#f0e9fc] hover:text-[#5b21b6]"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </form>

        {error && (
          <LoadError message="Failed to load units of measure — try refreshing the page." />
        )}

        <TableCard fetching={isFetching && !isLoading}>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-ink-muted">Loading units of measure…</div>
          ) : uoms.length === 0 ? (
            <EmptyState
              icon={search ? <Search className="h-8 w-8" /> : <Ruler className="h-10 w-10" />}
              title={search ? 'No units match' : 'No units of measure yet'}
              hint={
                search || !canCreate
                  ? undefined
                  : 'Create a base unit first, then add alternate units with conversion factors.'
              }
              action={!search ? addButton || undefined : undefined}
            />
          ) : (
            <>
              <UomTable rows={uoms} onEdit={canUpdate ? openEdit : undefined} />
              <ListFooterPager
                page={page}
                pageCount={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                noun="units"
                onPageChange={setPage}
              />
            </>
          )}
        </TableCard>

        <ConversionReference uoms={uoms} />
      </div>

      <UomFormModal
        isOpen={isCreateOpen}
        editTarget={editTarget}
        onClose={() => {
          setIsCreateOpen(false)
          setEditTarget(null)
        }}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
        baseUnits={baseUnits}
      />
    </div>
  )
}
