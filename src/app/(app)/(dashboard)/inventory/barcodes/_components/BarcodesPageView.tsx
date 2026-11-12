'use client'

import { useState } from 'react'
import { Plus, RefreshCw, Search, X, QrCode, Zap, Barcode, Trash2 } from 'lucide-react'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import type { SessionUser } from '@/src/libs/guards/permission'
import type { ItemSummary } from '@/src/schema/inventory/items'
import type { BarcodeType, CreateBarcodeFormValues } from '@/src/schema/inventory/barcodes'
import { BARCODE_TYPES } from '@/src/schema/inventory/barcodes'
import { useBarcodeManager } from '../_hooks/useBarcodeManager'
import { displayClassificationLabel } from '@/src/libs/format/text'
import Tooltip from '@/src/components/ui/Tooltip'
import { ListFooterPager } from '@/src/components/inventory/ListFooterPager'
import { MONO, PLEX } from '@/src/libs/design/plex'
import {
  EmptyState,
  ICON_BUTTON,
  ListHeader,
  ListSearch,
  PAGE_INNER,
  PAGE_SHELL,
  PRIMARY_BUTTON,
  TABLE_HEAD_ROW,
  TableCard,
} from '../../master-data/_components/masterDataChrome'

const CHECKBOX = 'h-4 w-4 rounded border-[#d3d3db] accent-[#5b21b6]'
const ROW_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg border border-[#d3d3db] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[#3d3d4a] hover:border-[#a3a3b2] hover:text-[#5b21b6] disabled:opacity-50'

const BARCODE_TYPE_LABELS: Record<BarcodeType, string> = {
  upc: 'UPC',
  ean13: 'EAN-13',
  code128: 'Code 128',
  qr: 'QR Code',
  custom: 'Custom',
}

// ── Manage Barcodes Modal ──────────────────────────────────────────────────────

function ManageBarcodesModal({
  item,
  barcodes,
  isLoadingBarcodes,
  isAdding,
  isGenerating,
  isDeleting,
  canManage,
  onClose,
  onGenerate,
  onAdd,
  onDelete,
}: {
  item: ItemSummary
  barcodes: { id: string; barcode: string; barcodeType: BarcodeType }[]
  isLoadingBarcodes: boolean
  isAdding: boolean
  isGenerating: boolean
  isDeleting: boolean
  canManage: boolean
  onClose: () => void
  onGenerate: (barcodeType: BarcodeType) => void
  onAdd: (data: CreateBarcodeFormValues) => void
  onDelete: (barcodeId: string) => void
}) {
  const [tab, setTab] = useState<'list' | 'generate' | 'manual'>('list')
  const [genType, setGenType] = useState<BarcodeType>('ean13')
  const [manualValue, setManualValue] = useState('')
  const [manualType, setManualType] = useState<BarcodeType>('custom')
  const [manualError, setManualError] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!manualValue.trim()) {
      setManualError('Barcode value is required')
      return
    }
    setManualError('')
    onAdd({ barcode: manualValue.trim(), barcodeType: manualType })
    setManualValue('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 p-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Manage Barcodes</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              {item.name}
              <span className="ml-2 font-mono text-xs text-zinc-400">{item.sku}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100">
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>

        {/* Sub-tabs */}
        {canManage && (
          <div className="flex gap-0 border-b border-zinc-100 px-5">
            {(['list', 'generate', 'manual'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`border-b-2 px-3 py-2.5 text-xs font-medium capitalize transition-colors ${
                  tab === t
                    ? 'border-prominent-orange-600 text-prominent-orange-700'
                    : 'border-transparent text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {t === 'list' ? 'Existing' : t === 'generate' ? 'Auto-generate' : 'Add Manual'}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Existing barcodes */}
          {(tab === 'list' || !canManage) && (
            <>
              {isLoadingBarcodes ? (
                <div className="py-10 text-center text-sm text-zinc-400">Loading barcodes…</div>
              ) : barcodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <QrCode className="mb-3 h-10 w-10 text-zinc-200" />
                  <p className="text-sm font-medium text-zinc-500">No barcodes yet</p>
                  {canManage && (
                    <p className="mt-1 text-xs text-zinc-400">
                      Use Auto-generate or Add Manual to assign a barcode.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {barcodes.map((b) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3"
                    >
                      <div>
                        <p className="font-mono text-sm font-medium text-zinc-900">{b.barcode}</p>
                        <p className="text-xs text-zinc-500">
                          {BARCODE_TYPE_LABELS[b.barcodeType]}
                        </p>
                      </div>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(b.id)}
                          title="Remove barcode"
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Delete confirm */}
          {deleteTargetId && (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-base font-semibold text-zinc-900">Remove Barcode</h3>
                <p className="mt-2 text-sm text-zinc-500">
                  Are you sure you want to remove this barcode? This action cannot be undone.
                </p>
                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setDeleteTargetId(null)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => {
                      onDelete(deleteTargetId)
                      setDeleteTargetId(null)
                    }}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? 'Removing…' : 'Remove'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Auto-generate */}
          {tab === 'generate' && canManage && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600">
                Auto-generate a barcode value. The system assigns the next available code in the
                selected format.
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                  Barcode Format
                </label>
                <select
                  value={genType}
                  onChange={(e) => setGenType(e.target.value as BarcodeType)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none focus:ring-2 focus:ring-prominent-orange-200"
                >
                  {BARCODE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {BARCODE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => onGenerate(genType)}
                disabled={isGenerating}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
              >
                <Zap className="h-4 w-4" />
                {isGenerating ? 'Generating…' : 'Generate Barcode'}
              </button>
            </div>
          )}

          {/* Manual entry */}
          {tab === 'manual' && canManage && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <p className="text-sm text-zinc-600">
                Enter an existing barcode value (e.g. from packaging or a vendor label).
              </p>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                  Barcode Value
                </label>
                <input
                  type="text"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder="e.g. 0012345678905"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none focus:ring-2 focus:ring-prominent-orange-200"
                />
                {manualError && <p className="mt-1 text-xs text-red-600">{manualError}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                  Barcode Type
                </label>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as BarcodeType)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none focus:ring-2 focus:ring-prominent-orange-200"
                >
                  {BARCODE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {BARCODE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={isAdding}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {isAdding ? 'Adding…' : 'Add Barcode'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Bulk Generate Modal ────────────────────────────────────────────────────────

function BulkGenerateModal({
  count,
  isBulkGenerating,
  onClose,
  onConfirm,
}: {
  count: number
  isBulkGenerating: boolean
  onClose: () => void
  onConfirm: (barcodeType: BarcodeType) => void
}) {
  const [type, setType] = useState<BarcodeType>('ean13')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Bulk Generate Barcodes</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Generate barcodes for {count} selected item{count !== 1 ? 's' : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100">
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-zinc-700">Barcode Format</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as BarcodeType)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-prominent-orange-400 focus:outline-none focus:ring-2 focus:ring-prominent-orange-200"
          >
            {BARCODE_TYPES.map((t) => (
              <option key={t} value={t}>
                {BARCODE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(type)}
            disabled={isBulkGenerating}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-prominent-purple-800 disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            {isBulkGenerating ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main View ──────────────────────────────────────────────────────────────────

export default function BarcodesPageView({ session }: { session: SessionUser }) {
  const canManage = hasPermission(session, INVENTORY_PERMISSIONS.BARCODES_MANAGE)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [quickGenItem, setQuickGenItem] = useState<ItemSummary | null>(null)

  const {
    items,
    pagination,
    isLoading,
    isFetching,
    search,
    setSearch,
    page,
    setPage,
    selectedItem,
    setSelectedItem,
    itemBarcodes,
    isLoadingBarcodes,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    generateBarcode,
    isGenerating,
    addBarcode,
    isAdding,
    deleteBarcode,
    isDeleting,
    bulkGenerate,
    isBulkGenerating,
    refetch,
  } = useBarcodeManager()

  async function handleQuickGenerate(item: ItemSummary) {
    setQuickGenItem(item)
    await generateBarcode(item.id, 'ean13')
    setQuickGenItem(null)
  }

  async function handleManageGenerate(barcodeType: BarcodeType) {
    if (!selectedItem) return
    await generateBarcode(selectedItem.id, barcodeType)
  }

  async function handleManageAdd(data: CreateBarcodeFormValues) {
    if (!selectedItem) return
    await addBarcode(selectedItem.id, data)
  }

  async function handleManageDelete(barcodeId: string) {
    if (!selectedItem) return
    await deleteBarcode(selectedItem.id, barcodeId)
  }

  async function handleBulkGenerate(barcodeType: BarcodeType) {
    await bulkGenerate(Array.from(selectedIds), barcodeType)
    setShowBulkModal(false)
  }

  const allSelected = items.length > 0 && selectedIds.size === items.length

  return (
    <div className={`${PAGE_SHELL} ${PLEX}`}>
      <div className={PAGE_INNER}>
        <ListHeader
          title="Barcode Management"
          description="Generate and manage barcodes assigned to inventory items."
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
              {canManage && selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBulkModal(true)}
                  className={PRIMARY_BUTTON}
                >
                  <Zap className="h-4 w-4" />
                  Generate for {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}
                </button>
              )}
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
            placeholder="Search items or SKU…"
          />
        </div>

        <TableCard fetching={isFetching && !isLoading}>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-ink-muted">Loading items…</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={search ? <Search className="h-8 w-8" /> : <Barcode className="h-10 w-10" />}
              title={search ? 'No items match' : 'No items yet'}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className={TABLE_HEAD_ROW}>
                    <tr>
                      {canManage && (
                        <th className="w-10 px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => toggleSelectAll(items)}
                            aria-label="Select all items"
                            className={CHECKBOX}
                          />
                        </th>
                      )}
                      <th className="px-4 py-2.5">Item</th>
                      <th className="hidden px-4 py-2.5 sm:table-cell">SKU</th>
                      <th className="hidden px-4 py-2.5 md:table-cell">Category</th>
                      <th className="px-4 py-2.5" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eeeef1]">
                    {items.map((item) => {
                      const selected = selectedIds.has(item.id)
                      const generating = isGenerating && quickGenItem?.id === item.id
                      return (
                        <tr
                          key={item.id}
                          className={selected ? 'bg-[#f6f2fd]' : 'hover:bg-[#fbfbfc]'}
                        >
                          {canManage && (
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleSelect(item.id)}
                                aria-label={`Select ${item.name}`}
                                className={CHECKBOX}
                              />
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#1d1d26]">{item.name}</p>
                            <p className={`mt-0.5 ${MONO} text-[12px] text-[#3f1490] sm:hidden`}>
                              {item.sku}
                            </p>
                          </td>
                          <td
                            className={`hidden px-4 py-3 ${MONO} font-medium text-[#3f1490] sm:table-cell`}
                          >
                            {item.sku}
                          </td>
                          <td className="hidden px-4 py-3 text-[#3d3d4a] md:table-cell">
                            {displayClassificationLabel(item.primaryCategory?.name) ?? '—'}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-end gap-2">
                              {canManage && (
                                <Tooltip label="Quick-generate an EAN-13 barcode" align="end">
                                  <button
                                    type="button"
                                    onClick={() => handleQuickGenerate(item)}
                                    disabled={generating}
                                    aria-label="Quick-generate EAN-13 barcode"
                                    className={ROW_BUTTON}
                                  >
                                    <Zap className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">
                                      {generating ? 'Generating…' : 'Quick EAN-13'}
                                    </span>
                                  </button>
                                </Tooltip>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedItem(item)}
                                className={ROW_BUTTON}
                              >
                                <QrCode className="h-3.5 w-3.5" />
                                Manage
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <ListFooterPager
                page={page}
                pageCount={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                noun="items"
                onPageChange={setPage}
              />
            </>
          )}
        </TableCard>
      </div>

      {/* Manage Barcodes Modal */}
      {selectedItem && (
        <ManageBarcodesModal
          item={selectedItem}
          barcodes={itemBarcodes as { id: string; barcode: string; barcodeType: BarcodeType }[]}
          isLoadingBarcodes={isLoadingBarcodes}
          isAdding={isAdding}
          isGenerating={isGenerating}
          isDeleting={isDeleting}
          canManage={canManage}
          onClose={() => setSelectedItem(null)}
          onGenerate={handleManageGenerate}
          onAdd={handleManageAdd}
          onDelete={handleManageDelete}
        />
      )}

      {/* Bulk Generate Modal */}
      {showBulkModal && (
        <BulkGenerateModal
          count={selectedIds.size}
          isBulkGenerating={isBulkGenerating}
          onClose={() => setShowBulkModal(false)}
          onConfirm={handleBulkGenerate}
        />
      )}
    </div>
  )
}
