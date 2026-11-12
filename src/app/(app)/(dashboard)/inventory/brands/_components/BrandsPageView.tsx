'use client'

import { useMemo, useState } from 'react'
import { RefreshCw, Search, Tag, Pencil, Trash2 } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import { useBrands } from '../_hooks/useBrands'
import BrandModal from './BrandModal'
import type {
  ItemClassification,
  ItemClassificationFormValues,
} from '@/src/schema/inventory/classification'
import { formatClassificationLabel } from '@/src/libs/format/text'
import Tooltip from '@/src/components/ui/Tooltip'
import { ListFooterPager } from '@/src/components/inventory/ListFooterPager'
import { PLEX } from '@/src/libs/design/plex'
import {
  DANGER_ICON_BUTTON,
  EmptyState,
  ICON_BUTTON,
  ListHeader,
  ListSearch,
  LoadError,
  PAGE_INNER,
  PAGE_SHELL,
  PRIMARY_BUTTON,
  TABLE_HEAD_ROW,
  TableCard,
} from '../../master-data/_components/masterDataChrome'

const PAGE_SIZE = 20

export default function BrandsPageView({ session }: { session: SessionUser }) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.ITEMS_MANAGE_CLASSIFICATION)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ItemClassification | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ItemClassification | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const {
    brands,
    isLoading,
    isFetching,
    error,
    refetch,
    createBrand,
    isCreating,
    updateBrand,
    isUpdating,
    deleteBrand,
    isDeleting,
  } = useBrands()

  const filteredBrands = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return brands
    return brands.filter(
      (brand) =>
        formatClassificationLabel(brand.name).toLowerCase().includes(query) ||
        (brand.description ?? '').toLowerCase().includes(query)
    )
  }, [brands, search])

  // Clamp rather than trust `page`: a refetch or a narrower search can shrink
  // the list below the page we were on.
  const pageCount = Math.max(1, Math.ceil(filteredBrands.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pagedBrands = useMemo(
    () => filteredBrands.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredBrands, currentPage]
  )

  function openCreate() {
    setEditTarget(null)
    setIsModalOpen(true)
  }

  function openEdit(brand: ItemClassification) {
    setEditTarget(brand)
    setIsModalOpen(true)
  }

  async function handleSubmit(data: ItemClassificationFormValues) {
    if (editTarget) return updateBrand(editTarget.id, data)
    return createBrand(data)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await deleteBrand(deleteTarget.id)
    setDeleteTarget(null)
  }

  const searching = !!search.trim()
  const addButton = canManage && (
    <button type="button" onClick={openCreate} className={PRIMARY_BUTTON}>
      + New Brand
    </button>
  )

  return (
    <div className={`${PAGE_SHELL} ${PLEX}`}>
      <div className={PAGE_INNER}>
        <ListHeader
          title="Brands"
          description="Manage the brand catalog used to classify inventory items."
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

        <div className="flex flex-wrap items-center gap-2">
          <ListSearch
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            placeholder="Search brands…"
          />
        </div>

        {error && <LoadError message="Failed to load brands — try refreshing the page." />}

        <TableCard fetching={isFetching && !isLoading}>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-ink-muted">Loading brands…</div>
          ) : filteredBrands.length === 0 ? (
            <EmptyState
              icon={searching ? <Search className="h-8 w-8" /> : <Tag className="h-10 w-10" />}
              title={searching ? 'No brands match' : 'No brands yet'}
              hint={searching || !canManage ? undefined : 'Add a brand to start classifying items.'}
              action={!searching ? addButton || undefined : undefined}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead className={TABLE_HEAD_ROW}>
                    <tr>
                      <th className="px-4 py-2.5">Name</th>
                      <th className="px-4 py-2.5">Description</th>
                      {canManage && <th className="w-24 px-4 py-2.5" aria-label="Actions" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eeeef1]">
                    {pagedBrands.map((brand) => (
                      <tr key={brand.id} className="hover:bg-[#fbfbfc]">
                        <td className="px-4 py-3 font-medium text-[#1d1d26]">
                          {formatClassificationLabel(brand.name)}
                        </td>
                        <td className="px-4 py-3 text-[#3d3d4a]">{brand.description ?? '—'}</td>
                        {canManage && (
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip label="Edit brand" align="end">
                                <button
                                  type="button"
                                  onClick={() => openEdit(brand)}
                                  aria-label={`Edit ${formatClassificationLabel(brand.name)}`}
                                  className={ICON_BUTTON}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </Tooltip>
                              <Tooltip label="Delete brand" align="end">
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(brand)}
                                  aria-label={`Delete ${formatClassificationLabel(brand.name)}`}
                                  className={DANGER_ICON_BUTTON}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </Tooltip>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ListFooterPager
                page={currentPage}
                pageCount={pageCount}
                total={filteredBrands.length}
                limit={PAGE_SIZE}
                noun="brands"
                onPageChange={setPage}
              />
            </>
          )}
        </TableCard>
      </div>

      <BrandModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
        editTarget={editTarget}
      />

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Delete Brand</h3>
            <p className="mt-2 text-sm text-zinc-500">
              Are you sure you want to delete{' '}
              <span className="font-medium text-zinc-800">
                {formatClassificationLabel(deleteTarget.name)}
              </span>
              ? Brands still assigned to items cannot be deleted.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
