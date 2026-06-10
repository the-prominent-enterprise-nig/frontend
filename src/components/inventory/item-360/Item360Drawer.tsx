'use client'

import { useState } from 'react'
import { X, PackageCheck, ArrowLeftRight, Pencil, ChevronLeft } from 'lucide-react'
import { useItem360 } from './hooks/useItem360'
import OverviewTab from './tabs/OverviewTab'
import StockTab from './tabs/StockTab'
import MovementsTab from './tabs/MovementsTab'
import SubstitutesTab from './tabs/SubstitutesTab'
import HistoryTab from './tabs/HistoryTab'
import type { ItemSubstitute, ItemChangeLog } from '@/src/schema/inventory/items'
import { useUIShell } from '@/src/stores/ui-shell.store'
import { createPortal } from 'react-dom'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'stock', label: 'Stock' },
  { id: 'movements', label: 'Movements' },
  { id: 'substitutes', label: 'Substitutes' },
  { id: 'history', label: 'History' },
] as const

type Tab = (typeof TABS)[number]['id']

const LIFECYCLE_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  discontinued: 'bg-orange-100 text-orange-700',
  archived: 'bg-zinc-100 text-zinc-500',
}

function DrawerSkeleton() {
  return (
    <div className="animate-pulse space-y-4 p-5">
      <div className="h-5 w-2/3 rounded bg-zinc-200" />
      <div className="h-4 w-1/3 rounded bg-zinc-100" />
      <div className="mt-6 space-y-3">
        <div className="h-12 rounded-lg bg-zinc-100" />
        <div className="h-12 rounded-lg bg-zinc-100" />
        <div className="h-12 rounded-lg bg-zinc-100" />
      </div>
    </div>
  )
}

function Item360Content({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const { item, stock, movements, substitutes, history } = useItem360(itemId, activeTab)

  type BalanceList = { data: import('@/src/schema/inventory/goods-receiving').StockBalance[] }
  type LedgerList = { data: import('@/src/schema/inventory/goods-receiving').StockLedgerEntry[] }
  const itemData = item.data?.success ? item.data.data : null
  const stockData = stock.data?.success ? (stock.data.data as unknown as BalanceList) : null
  const movementsData = movements.data?.success
    ? (movements.data.data as unknown as LedgerList)
    : null
  const substitutesData = substitutes.data?.success
    ? ((substitutes.data.data as unknown as { data: ItemSubstitute[] })?.data ??
      (substitutes.data.data as unknown as ItemSubstitute[]) ??
      [])
    : []
  const historyData = history.data?.success
    ? ((history.data.data as unknown as { data: ItemChangeLog[] })?.data ??
      (history.data.data as unknown as ItemChangeLog[]) ??
      [])
    : []

  const lifecycle = (itemData as { lifecycle?: string } | null)?.lifecycle ?? 'active'

  return (
    <>
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-200 bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {item.isLoading ? (
              <div className="space-y-2">
                <div className="h-5 w-48 animate-pulse rounded bg-zinc-200" />
                <div className="h-3.5 w-24 animate-pulse rounded bg-zinc-100" />
              </div>
            ) : itemData ? (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-semibold text-zinc-900 leading-tight">
                    {itemData.name}
                  </h2>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${LIFECYCLE_COLORS[lifecycle]}`}
                  >
                    {lifecycle}
                  </span>
                  {itemData.isBundle && (
                    <span className="inline-flex shrink-0 rounded-full bg-prominent-purple-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-prominent-purple-700">
                      Bundle
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-xs text-zinc-400">{itemData.sku}</p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">Item not found</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick actions */}
        {itemData && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={`/inventory/goods-receiving`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-prominent-purple-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-prominent-purple-800"
            >
              <PackageCheck className="h-3.5 w-3.5" />
              Receive Stock
            </a>
            <a
              href={`/inventory/transfers`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Transfer
            </a>
            <a
              href={`/inventory/write-offs`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Adjust
            </a>
          </div>
        )}
      </div>

      {/* Tab nav */}
      <div className="shrink-0 border-b border-zinc-200 bg-white">
        <nav className="flex overflow-x-auto px-5" aria-label="Item 360 tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 border-b-2 px-3 py-3 text-[13px] font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-prominent-purple-600 text-prominent-purple-700'
                  : 'border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {item.isLoading ? (
          <DrawerSkeleton />
        ) : !itemData ? (
          <div className="p-5 text-sm text-zinc-400">Failed to load item details.</div>
        ) : activeTab === 'overview' ? (
          <OverviewTab item={itemData} />
        ) : activeTab === 'stock' ? (
          <StockTab balances={stockData?.data ?? []} isLoading={stock.isLoading} />
        ) : activeTab === 'movements' ? (
          <MovementsTab
            entries={
              movementsData?.data ??
              ([] as import('@/src/schema/inventory/goods-receiving').StockLedgerEntry[])
            }
            isLoading={movements.isLoading}
          />
        ) : activeTab === 'substitutes' ? (
          <SubstitutesTab
            itemId={itemId}
            substitutes={substitutesData}
            isLoading={substitutes.isLoading}
          />
        ) : activeTab === 'history' ? (
          <HistoryTab entries={historyData} isLoading={history.isLoading} />
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
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Back button when stacked */}
        {hasMultiple && isOpen && (
          <div className="shrink-0 border-b border-zinc-100 bg-zinc-50 px-4 py-2">
            <button
              type="button"
              onClick={popPanel}
              className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
          </div>
        )}

        {isOpen && itemId ? (
          <Item360Content key={itemId} itemId={itemId} onClose={popPanel} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-zinc-400">Select an item to view details.</p>
          </div>
        )}
      </div>
    </>,
    document.body
  )
}
