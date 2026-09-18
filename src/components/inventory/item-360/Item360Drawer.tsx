'use client'

import { useState } from 'react'
import { X, PackageCheck, ArrowLeftRight, ChevronLeft } from 'lucide-react'
import { useItem360 } from './hooks/useItem360'
import OverviewTab from './tabs/OverviewTab'
import StockTab from './tabs/StockTab'
import SerialMovementsTab from './tabs/SerialMovementsTab'
import MovementsTab from './tabs/MovementsTab'
import type { SerialNumberSummary } from '@/src/schema/inventory/serial-numbers'
import type { StockBalance } from '@/src/schema/inventory/goods-receiving'
import { useUIShell } from '@/src/stores/ui-shell.store'
import { createPortal } from 'react-dom'
import {
  PLEX,
  MONO,
} from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_components/procurementTokens'

type DrawerContext = 'catalog' | 'stock'

// No standalone Serials tab — each location's units are shown inline (expand
// a location row in Stock) rather than in a separate list, matching Stock
// Balance's own drawer design.
const TABS = [
  { id: 'overview', label: 'Overview', context: 'catalog' },
  { id: 'stock', label: 'Stock', context: 'stock' },
  { id: 'movements', label: 'Movements', context: 'stock' },
] as const satisfies readonly { id: string; label: string; context: DrawerContext }[]

type Tab = (typeof TABS)[number]['id']

const DEFAULT_TAB: Record<DrawerContext, Tab> = { catalog: 'overview', stock: 'stock' }

// The 'stock' tabs (Stock/Movements — every entry point except the Items
// catalog) follow Purchase Orders' own #5b21b6 palette, same choice already
// made for Stock Balance, which is where most of this drawer's traffic comes
// from. The 'catalog' Overview tab is untouched and keeps the app-wide
// zinc/prominent-purple look — PLEX is applied per-section below, not at the
// drawer root, so it never bleeds into it.
const LIFECYCLE_META: Record<string, string> = {
  active: 'bg-[#e7f5ef] text-[#0b6644]',
  discontinued: 'bg-[#fdf3e7] text-[#8a4b06]',
  archived: 'bg-[#f1f1f4] text-[#5b5b6b]',
}

// Same four states Stock Balance's own row badges use — the header repeats
// them at the item level so the drawer and the row it was opened from read
// as one status, not two different vocabularies.
type StockStatus = 'out' | 'fully_reserved' | 'low' | 'in_stock'

const STOCK_STATUS_META: Record<StockStatus, { label: string; badge: string }> = {
  out: { label: 'Out of Stock', badge: 'bg-[#fdeceb] text-[#b42318]' },
  fully_reserved: { label: 'Fully Reserved', badge: 'bg-[#eaf0fb] text-[#1f4b99]' },
  low: { label: 'Low Stock', badge: 'bg-[#fdf3e7] text-[#8a4b06]' },
  in_stock: { label: 'In Stock', badge: 'bg-[#e7f5ef] text-[#0b6644]' },
}

function stockStatusOf(balances: StockBalance[]): StockStatus {
  const onHand = balances.reduce((s, b) => s + Number(b.onHandQty ?? 0), 0)
  const available = balances.reduce((s, b) => s + Number(b.availableQty ?? 0), 0)
  if (onHand <= 0) return 'out'
  if (available <= 0) return 'fully_reserved'
  const anyBelowReorder = balances.some((b) => {
    const qty = Number(b.onHandQty ?? 0)
    const reorder = b.reorderPoint != null ? Number(b.reorderPoint) : null
    return reorder !== null && qty <= reorder
  })
  return anyBelowReorder ? 'low' : 'in_stock'
}

const TRACKING_META = {
  serial: { label: 'Serial-tracked', badge: 'bg-[#eaf0fb] text-[#1f4b99]' },
  none: { label: 'Non-tracked', badge: 'bg-[#f1f1f4] text-[#5b5b6b]' },
}

function DrawerSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-5">
      <div className="h-5 w-2/3 rounded bg-[#eeeef1]" />
      <div className="h-4 w-1/3 rounded bg-[#f4f4f6]" />
      <div className="mt-6 space-y-3">
        <div className="h-12 rounded-lg bg-[#f4f4f6]" />
        <div className="h-12 rounded-lg bg-[#f4f4f6]" />
        <div className="h-12 rounded-lg bg-[#f4f4f6]" />
      </div>
    </div>
  )
}

function Item360Content({
  itemId,
  context,
  locations,
  onClose,
}: {
  itemId: string
  context: DrawerContext
  locations?: string[]
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<Tab>(DEFAULT_TAB[context])
  const [selectedSerial, setSelectedSerial] = useState<SerialNumberSummary | null>(null)
  const visibleTabs = TABS.filter((tab) => tab.context === context)
  const { item, stock, serials } = useItem360(itemId, activeTab, locations)

  const itemData = item.data?.success ? item.data.data : null
  const stockBalances: StockBalance[] = stock.data?.success
    ? ((stock.data.data as { data: StockBalance[] } | undefined)?.data ?? [])
    : []
  const serialsData: SerialNumberSummary[] = serials.data?.success
    ? (serials.data.data?.data ?? [])
    : []

  const lifecycle = (itemData as { lifecycle?: string } | null)?.lifecycle ?? 'active'
  // Both only mean something once the Stock tab's own queries have actually
  // run — they're enabled on activeTab === 'stock', which is this context's
  // default tab, so they're already loading by the time this renders.
  const stockStatus = context === 'stock' && !stock.isLoading ? stockStatusOf(stockBalances) : null
  const tracking =
    context === 'stock' && !serials.isLoading
      ? serialsData.length > 0
        ? TRACKING_META.serial
        : TRACKING_META.none
      : null

  return (
    <>
      {/* Header */}
      <div className={`${PLEX} shrink-0 border-b border-[#e4e4e9] bg-white px-5 py-4`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {item.isLoading ? (
              <div className="space-y-2">
                <div className="h-5 w-48 animate-pulse rounded bg-[#eeeef1]" />
                <div className="h-3.5 w-24 animate-pulse rounded bg-[#f4f4f6]" />
              </div>
            ) : itemData ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] leading-tight font-semibold text-[#17171c]">
                    {itemData.name}
                  </h2>
                  {context === 'stock' ? (
                    stockStatus && (
                      <span
                        className={`inline-flex shrink-0 items-center rounded-[5px] px-2 py-0.5 text-[11px] font-medium ${STOCK_STATUS_META[stockStatus].badge}`}
                      >
                        {STOCK_STATUS_META[stockStatus].label}
                      </span>
                    )
                  ) : (
                    <span
                      className={`inline-flex shrink-0 items-center rounded-[5px] px-2 py-0.5 text-[11px] font-medium capitalize ${
                        LIFECYCLE_META[lifecycle] ?? LIFECYCLE_META.active
                      }`}
                    >
                      {lifecycle}
                    </span>
                  )}
                  {itemData.isBundle && (
                    <span className="inline-flex shrink-0 rounded-[5px] bg-[#f1ebfb] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#3f1490] uppercase">
                      Bundle
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <p className={`${MONO} text-[11.5px] text-[#8b8b9b]`}>{itemData.sku}</p>
                  {tracking && (
                    <span
                      className={`inline-flex shrink-0 rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${tracking.badge}`}
                    >
                      {tracking.label}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[13px] text-[#8b8b9b]">Item not found</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-[#8b8b9b] hover:bg-[#f1f1f4] hover:text-[#3d3d4a]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick actions — operational, so Stock-context only */}
        {itemData && context === 'stock' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={`/inventory/operations?tab=receiving`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#5b21b6] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-[#4a189b]"
            >
              <PackageCheck className="h-3.5 w-3.5" />
              Receive Stock
            </a>
            <a
              href={`/inventory/transfers`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d3d3db] bg-white px-3 py-1.5 text-[12px] font-medium text-[#3d3d4a] hover:border-[#a3a3b2]"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Transfer
            </a>
          </div>
        )}
      </div>

      {/* Tab nav — hidden when there's only one tab to switch between (the
          Items catalog's Overview-only case), or while drilled into a single
          serial's own movement timeline */}
      {visibleTabs.length > 1 && !selectedSerial && (
        <div className={`${PLEX} shrink-0 border-b border-[#e4e4e9] bg-white`}>
          <nav className="flex overflow-x-auto px-5" aria-label="Item 360 tabs">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id)
                  setSelectedSerial(null)
                }}
                className={`shrink-0 border-b-2 px-3 py-3 text-[12.5px] font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#5b21b6] text-[#5b21b6]'
                    : 'border-transparent text-[#8b8b9b] hover:border-[#e4e4e9] hover:text-[#3d3d4a]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Tab content — Overview keeps the app's default (Poppins) font since
          neither this wrapper nor OverviewTab itself carries PLEX. A selected
          serial takes over the panel regardless of which tab is active — the
          only way to reach one is by expanding a location in Stock, so it's
          effectively Stock's own drill-down rather than a tab of its own. */}
      <div className="flex-1 overflow-y-auto">
        {selectedSerial ? (
          <SerialMovementsTab serial={selectedSerial} onBack={() => setSelectedSerial(null)} />
        ) : item.isLoading ? (
          <DrawerSkeleton />
        ) : !itemData ? (
          <div className="p-5 text-[13px] text-[#8b8b9b]">Failed to load item details.</div>
        ) : activeTab === 'overview' ? (
          <OverviewTab item={itemData} />
        ) : activeTab === 'stock' ? (
          <StockTab
            itemId={itemId}
            itemLabel={itemData.name}
            balances={stockBalances}
            isLoading={stock.isLoading}
            serials={serialsData}
            serialsLoading={serials.isLoading}
            onSelectSerial={setSelectedSerial}
          />
        ) : activeTab === 'movements' ? (
          <MovementsTab itemId={itemId} locations={locations} />
        ) : null}
      </div>
    </>
  )
}

export default function Item360Drawer() {
  const { panelStack, popPanel } = useUIShell()

  const topPanel = panelStack[panelStack.length - 1]
  const isOpen = topPanel?.type === 'item360'
  const itemId = topPanel?.type === 'item360' ? topPanel.itemId : null
  // Pre-existing call sites not yet updated to pass a context fall back to
  // 'stock' (the broader, operational tab set) rather than 'catalog', so
  // they keep working sensibly until they're migrated.
  const context: DrawerContext =
    topPanel?.type === 'item360' ? (topPanel.context ?? 'stock') : 'stock'
  // Call sites that pass nothing leave this undefined, which means "every
  // location" — the drawer's behaviour before Scenario 50, unchanged for
  // them.
  const locations = topPanel?.type === 'item360' ? topPanel.locations : undefined
  const hasMultiple = panelStack.length > 1

  if (typeof window === 'undefined') return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={popPanel}
        className={`fixed inset-0 z-40 bg-black/25 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Item Details"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[820px] flex-col border-l border-[#e4e4e9] bg-white shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Back button when stacked */}
        {hasMultiple && isOpen && (
          <div className="shrink-0 border-b border-[#f1f1f4] bg-[#fbfbfc] px-4 py-2">
            <button
              type="button"
              onClick={popPanel}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#8b8b9b] hover:text-[#17171c]"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
          </div>
        )}

        {isOpen && itemId ? (
          <Item360Content
            key={itemId}
            itemId={itemId}
            context={context}
            locations={locations}
            onClose={popPanel}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[13px] text-[#8b8b9b]">Select an item to view details.</p>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}
