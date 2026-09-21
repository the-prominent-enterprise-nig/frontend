'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, RefreshCw, Search, Tags, Pencil, Trash2 } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import Drawer from '@/src/components/ui/drawer/Drawer'
import Tooltip from '@/src/components/ui/Tooltip'
import { usePriceUseTypes } from '../../price-use-types/_hooks/usePriceUseTypes'
import PriceUseTypeModal from '../../price-use-types/_components/PriceUseTypeModal'
import type { PriceList } from '@/src/schema/inventory/price-lists'
import type { PriceUseType, PriceUseTypeFormValues } from '@/src/schema/inventory/price-use-types'
import { PLEX, MONO } from '@/src/libs/design/plex'

type Props = {
  isOpen: boolean
  onClose: () => void
  session: SessionUser
  /** Every price list already loaded by the page behind this drawer — used
   * to show how many lists each type is carrying, and to stop a delete that
   * the database would reject anyway (the FK is restricted server-side). */
  priceLists?: PriceList[]
}

export default function ManageCategoriesDrawer({
  isOpen,
  onClose,
  session,
  priceLists = [],
}: Props) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.PRICE_LISTS_MANAGE_PRICE_USE_TYPES)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingType, setEditingType] = useState<PriceUseType | undefined>(undefined)
  const [deletingType, setDeletingType] = useState<PriceUseType | null>(null)
  const [search, setSearch] = useState('')

  const {
    priceUseTypes,
    isLoading,
    isFetching,
    error,
    createPriceUseType,
    isCreating,
    updatePriceUseType,
    isUpdating,
    deletePriceUseType,
    isDeleting,
    refetch,
  } = usePriceUseTypes()

  const usageByTypeId = useMemo(() => {
    const counts = new Map<string, number>()
    for (const pl of priceLists) {
      counts.set(pl.priceUseTypeId, (counts.get(pl.priceUseTypeId) ?? 0) + 1)
    }
    return counts
  }, [priceLists])

  function usageCount(type: PriceUseType) {
    return usageByTypeId.get(type.id) ?? 0
  }

  const query = search.trim().toLowerCase()
  const visible = priceUseTypes.filter(
    (t) =>
      !query ||
      t.name.toLowerCase().includes(query) ||
      (t.description ?? '').toLowerCase().includes(query)
  )
  // Turning a type off doesn't touch the price lists already under it — it
  // only stops it being offered for new ones and hides it at checkout. So
  // the two groups are "still selectable" and "kept for history", and the
  // split makes that the first thing the reader sees.
  const liveTypes = visible.filter((t) => t.isActive)
  const retiredTypes = visible.filter((t) => !t.isActive)

  function openCreateModal() {
    setEditingType(undefined)
    setIsModalOpen(true)
  }

  function openEditModal(type: PriceUseType) {
    setEditingType(type)
    setIsModalOpen(true)
  }

  async function handleSubmit(data: PriceUseTypeFormValues) {
    return editingType ? updatePriceUseType({ id: editingType.id, data }) : createPriceUseType(data)
  }

  async function handleDelete() {
    if (!deletingType) return
    await deletePriceUseType(deletingType.id)
    setDeletingType(null)
  }

  async function handleToggleActive(type: PriceUseType) {
    await updatePriceUseType({ id: type.id, data: { isActive: !type.isActive } })
  }

  async function handleRetireInstead() {
    if (!deletingType) return
    await updatePriceUseType({ id: deletingType.id, data: { isActive: false } })
    setDeletingType(null)
  }

  const deletingUsage = deletingType ? usageCount(deletingType) : 0
  const canHardDelete = deletingUsage === 0

  // Cards, not table rows — but the ARIA table roles stay so each card is
  // still addressable as a row by assistive tech (and by the e2e suite).
  function renderGroup(title: string, note: string, types: PriceUseType[]) {
    if (types.length === 0) return null
    return (
      <div role="rowgroup" className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-2 px-1 pt-1">
          <span
            className={`${MONO} text-[10px] font-semibold uppercase tracking-[0.09em] text-[#5b5b6b]`}
          >
            {title}
          </span>
          <span className="text-[11px] text-[#8b8b9b]">{note}</span>
        </div>
        {types.map((type) => {
          const used = usageCount(type)
          return (
            <div
              key={type.id}
              role="row"
              className={`flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[#e4e4e9] bg-white p-4 ${
                type.isActive ? '' : 'opacity-70'
              }`}
            >
              <div role="cell" className="min-w-0 flex-1 space-y-1.5">
                <span
                  className={`inline-block rounded px-2 py-0.5 ${MONO} text-[11px] font-semibold ${
                    type.isActive ? 'bg-[#f1ebfb] text-[#3f1490]' : 'bg-[#f1f1f4] text-[#5b5b6b]'
                  }`}
                >
                  {type.name}
                </span>
                <p className="text-sm text-[#5b5b6b]">{type.description || '—'}</p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div role="cell" className="text-right">
                  <p className={`${MONO} text-xs ${used ? 'text-[#3d3d4a]' : 'text-[#8b8b9b]'}`}>
                    {used ? `${used} list${used === 1 ? '' : 's'}` : 'Unused'}
                  </p>
                  <p className="text-[11px] text-[#8b8b9b]">
                    {used ? 'priced under it' : 'no price lists'}
                  </p>
                </div>

                <div role="cell">
                  {canManage ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={type.isActive}
                      aria-label={`${type.isActive ? 'Turn off' : 'Turn on'} ${type.name}`}
                      title={
                        type.isActive
                          ? 'In use — selectable on a new price list'
                          : 'Turned off — hidden from new price lists'
                      }
                      onClick={() => handleToggleActive(type)}
                      disabled={isUpdating}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                        type.isActive ? 'bg-[#5b21b6]' : 'bg-[#e4e4e9]'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          type.isActive ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  ) : (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        type.isActive
                          ? 'bg-[#e7f5ef] text-[#0b6644]'
                          : 'bg-[#f1f1f4] text-[#5b5b6b]'
                      }`}
                    >
                      {type.isActive ? 'Active' : 'Inactive'}
                    </span>
                  )}
                </div>

                {canManage && (
                  <div role="cell" className="flex items-center gap-1">
                    <Tooltip label="Edit" side="top" align="end">
                      <button
                        type="button"
                        aria-label="Edit"
                        onClick={() => openEditModal(type)}
                        className="rounded-lg border border-[#e4e4e9] p-1.5 text-[#5b5b6b] hover:bg-[#fbfbfc] hover:text-[#3f1490]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </Tooltip>
                    <Tooltip label="Delete" side="top" align="end">
                      <button
                        type="button"
                        aria-label="Delete"
                        onClick={() => setDeletingType(type)}
                        className={`rounded-lg border p-1.5 ${
                          used
                            ? 'border-[#e4e4e9] text-[#c9c9d3]'
                            : 'border-[#f3c9c5] text-[#b42318] hover:bg-[#fdeceb]'
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title="Price use types"
        subtitle="The payment scenarios a price list can price for. Every price list belongs to exactly one."
        width="lg"
        panelClassName={PLEX}
      >
        <div className="space-y-4 p-5">
          <p className="text-sm text-[#5b5b6b]">
            The payment scenarios a price list can price for. Every price list belongs to exactly
            one of them.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8b9b]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or description…"
                className="w-full rounded-lg border border-[#e4e4e9] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#5b21b6] focus:ring-1 focus:ring-[#5b21b6]"
              />
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-lg border border-[#e4e4e9] px-3 py-2 text-sm font-medium text-[#3d3d4a] hover:bg-[#fbfbfc] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {canManage && (
              <button
                type="button"
                onClick={openCreateModal}
                className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a189b]"
              >
                <Plus className="h-4 w-4" />
                New use type
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-[#f3c9c5] bg-[#fdeceb] p-4">
              <p className="text-sm font-medium text-[#8f1c14]">Failed to load price use types</p>
            </div>
          )}

          <div
            role="table"
            aria-label="Price use types"
            className={`space-y-3 transition-opacity ${isFetching ? 'opacity-60' : ''}`}
          >
            {isLoading ? (
              <div className="rounded-xl border border-[#e4e4e9] bg-white p-8 text-center text-sm text-[#8b8b9b]">
                Loading price use types…
              </div>
            ) : priceUseTypes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-[#e4e4e9] bg-white py-16">
                <Tags className="mb-3 h-10 w-10 text-[#c9c9d3]" />
                <p className="text-sm font-medium text-[#5b5b6b]">No price use types yet</p>
                {canManage && (
                  <p className="mt-1 text-xs text-[#8b8b9b]">
                    Create one to start categorizing price lists, e.g. WIP, CR-BR, SSC.
                  </p>
                )}
              </div>
            ) : visible.length === 0 ? (
              <div className="rounded-xl border border-[#e4e4e9] bg-white py-12 text-center text-sm text-[#8b8b9b]">
                No price use type matches “{search}”.
              </div>
            ) : (
              <>
                {renderGroup('In use', 'selectable when creating a price list', liveTypes)}
                {renderGroup(
                  'Turned off',
                  'existing lists keep working — hidden from new ones',
                  retiredTypes
                )}
              </>
            )}
          </div>
        </div>
      </Drawer>

      <PriceUseTypeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={editingType ? isUpdating : isCreating}
        initial={editingType}
      />

      {deletingType &&
        createPortal(
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-[#17171c]">Delete price use type?</h2>
              {canHardDelete ? (
                <p className="mt-2 text-sm text-[#5b5b6b]">
                  This removes <strong>{deletingType.name}</strong>. No price list is using it, so
                  nothing else changes.
                </p>
              ) : (
                // Deleting is refused by the database while lists still point
                // at the type, so offering the button at all would only ever
                // produce an error. Turning it off is what the reader actually
                // wants: the existing lists keep pricing, nobody can pick it
                // for a new one.
                <p className="mt-2 text-sm text-[#5b5b6b]">
                  <strong>{deletingType.name}</strong> is used by {deletingUsage} price list
                  {deletingUsage === 1 ? '' : 's'}. Deleting it would leave{' '}
                  {deletingUsage === 1 ? 'that list' : 'those lists'} without a use type, so it
                  can&apos;t be deleted until {deletingUsage === 1 ? 'it is' : 'they are'}{' '}
                  reassigned or removed. Turn it off instead — existing lists keep working, and
                  nobody can pick it for a new one.
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingType(null)}
                  disabled={isDeleting || isUpdating}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[#3d3d4a] hover:bg-[#f1f1f4] disabled:opacity-50"
                >
                  {canHardDelete ? 'Cancel' : 'Keep it'}
                </button>
                {canHardDelete ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="rounded-lg bg-[#b42318] px-4 py-2 text-sm font-medium text-white hover:bg-[#b42318] disabled:opacity-60"
                  >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </button>
                ) : (
                  deletingType.isActive && (
                    <button
                      type="button"
                      onClick={handleRetireInstead}
                      disabled={isUpdating}
                      className="rounded-lg bg-[#d18b1d] px-4 py-2 text-sm font-medium text-white hover:bg-[#d18b1d] disabled:opacity-60"
                    >
                      {isUpdating ? 'Turning off…' : 'Turn off instead'}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
