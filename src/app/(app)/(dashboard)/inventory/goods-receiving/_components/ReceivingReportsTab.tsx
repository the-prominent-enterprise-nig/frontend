'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, X, RefreshCw, ClipboardList, Download, Copy, Check, Plus } from 'lucide-react'
import { useReceivingReports } from '../_hooks/useReceivingReports'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { StatusBadge } from '@/src/components/ui/StatusBadge'
import Tooltip from '@/src/components/ui/Tooltip'
import { showToast } from '@/src/components/ui/toast'
import { downloadCsv } from '@/src/libs/format/csv-export'
import { getReceivingReports } from '../_actions/get-receiving-reports'
import { receiveStock } from '../_actions/receive-stock'
import ReceiveStockModal from './ReceiveStockModal'
import { getWarehouses } from '../../warehouses/_actions/get-warehouses'
import { getItems } from '../../items/_actions/get-items'
import { useMe } from '@/src/hooks/useMe'
import { hasPermission } from '@/src/hooks/usePermission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { STALE } from '@/src/libs/query/stale-times'
import type {
  ReceiveStockFormValues,
  ReceivingReport,
} from '@/src/schema/inventory/goods-receiving'
import { receivingReportPoNumber } from '@/src/libs/format/receiving-po-number'
import { PLEX, MONO } from '../../purchase-orders/_components/procurementTokens'

// ─── Design tokens ──────────────────────────────────────────────────────────
// Same IBM Plex + #5b21b6 palette as the sibling Stock Ledger/Stock Balance
// tabs, and the same CSS-grid "table" (role="table"/"row"/"cell" instead of
// a real <table>) so columns line up the same way Stock Balance's do.

const CONTROL_CHROME = {
  idle: 'border-[#d3d3db]',
  focused: 'border-[#5b21b6] shadow-[0_0_0_3px_#f0e9fc]',
}

// GoodsReceiptStatus (backend enum) → display. "received" is the normal,
// posted-to-the-ledger end state — everything else is a receipt that hasn't
// finished its life cycle yet.
const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  draft: { label: 'Draft', badge: 'bg-[#f1f1f4] text-[#3d3d4a]', dot: 'bg-zinc-400' },
  received: { label: 'Posted', badge: 'bg-[#e7f5ef] text-[#0b6644]', dot: 'bg-emerald-500' },
  quality_hold: {
    label: 'Quality Hold',
    badge: 'bg-[#fdf3e7] text-[#8a4b06]',
    dot: 'bg-amber-500',
  },
  rejected: { label: 'Rejected', badge: 'bg-[#fdeceb] text-[#b42318]', dot: 'bg-red-500' },
}

const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}))

// The column track the header, rows and skeletons all share — same
// CSS-grid approach as Stock Balance, since a plain <table> couldn't keep
// numeric columns aligned once the Amount column is conditionally present.
const GRID = 'grid grid-cols-[196px_minmax(0,1fr)_140px_64px_80px_120px] gap-x-3 items-center'
const GRID_WITH_AMOUNT =
  'grid grid-cols-[196px_minmax(0,1fr)_140px_64px_80px_110px_120px] gap-x-3 items-center'

function fmtMoney(n: number): string {
  return n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })
}

// A line's cost is only meaningful when someone actually entered it — a
// freebie or a receipt with no cost-view access carries unitCost 0/null,
// which must read as "no cost recorded", not "this cost is zero".
function lineAmount(line: ReceivingReport['lines'][number]): number | null {
  if (line.unitCost == null) return null
  return line.quantityReceived * line.unitCost
}

function reportAmount(report: ReceivingReport): number | null {
  const amounts = report.lines.map(lineAmount).filter((a): a is number => a != null)
  return amounts.length > 0 ? amounts.reduce((sum, a) => sum + a, 0) : null
}

function reportUnits(report: ReceivingReport): number {
  return report.lines.reduce((sum, l) => sum + l.quantityReceived, 0)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// A receipt entered through "Receive Against PO" carries a real FK per
// line, so it can deep-link into the PO detail view. A receipt entered
// through the standalone Receive Stock form only has a free-text PO
// number typed by the clerk — nothing to link to.
function receivingReportPoId(report: ReceivingReport): string | null {
  for (const line of report.lines) {
    const id = line.purchaseOrderLine?.purchaseOrderId
    if (id) return id
  }
  return null
}

function SkeletonBar({ wide }: { wide?: boolean }) {
  return (
    <span
      className={`block animate-pulse rounded-[3px] bg-[#eeeef1] ${
        wide ? 'h-[18px] w-[70px] rounded-[5px]' : 'h-[10px] w-full'
      }`}
    />
  )
}

function StatCell({
  label,
  value,
  loading,
  hint,
  tone = 'default',
}: {
  label: string
  value: number | undefined
  loading: boolean
  hint: string
  tone?: 'default' | 'highlight' | 'warning'
}) {
  const valueColor =
    tone === 'highlight'
      ? 'text-[#0b6644]'
      : tone === 'warning'
        ? 'text-[#8a4b06]'
        : 'text-[#17171c]'
  return (
    <div className={`flex flex-col gap-1 px-5 py-4 ${tone === 'highlight' ? 'bg-[#f0f9f4]' : ''}`}>
      <span className={`${MONO} text-[10px] uppercase tracking-[.09em] text-[#8b8b9b]`}>
        {label}
      </span>
      {loading ? (
        <span className="h-[26px] w-12 animate-pulse rounded bg-[#eeeef1]" />
      ) : (
        <span className={`text-[22px] font-semibold tabular-nums ${valueColor}`}>
          {(value ?? 0).toLocaleString()}
        </span>
      )}
      <span className="text-[11.5px] text-[#5b5b6b]">{hint}</span>
    </div>
  )
}

/** Copy-to-clipboard for the receipt code — the number people key into the
 * supplier's system or read out over the phone, so retyping it by hand is
 * the actual friction this button removes. */
function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      showToast({ title: 'Could not copy', status: 'error' })
    }
  }

  return (
    <Tooltip label={copied ? 'Copied!' : 'Copy receipt no.'}>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy receipt number"
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-[#a3a3b2] hover:bg-[#f1f1f4] hover:text-[#5b21b6]"
      >
        {copied ? <Check className="h-3 w-3 text-[#0b6644]" /> : <Copy className="h-3 w-3" />}
      </button>
    </Tooltip>
  )
}

function PoLink({ report }: { report: ReceivingReport }) {
  const router = useRouter()
  const code = receivingReportPoNumber(report)
  const poId = receivingReportPoId(report)
  if (!code) return null
  if (!poId) {
    return <p className={`${MONO} truncate text-[11px] text-[#8b8b9b]`}>{code}</p>
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        router.push(`/inventory/purchase-orders?po=${poId}`)
      }}
      className={`${MONO} truncate text-left text-[11px] text-[#5b21b6] hover:underline`}
    >
      {code}
    </button>
  )
}

type Props = {
  // Amounts are financial info (unit cost / total cost) — shown for
  // Accounting's own Receiving Reports view, hidden for Inventory's
  // (warehouse/receiving staff don't need supplier cost visibility here).
  showAmounts?: boolean
  /** Where a row opens. This list is rendered by both Inventory and
   * Accounting; a click should keep you inside whichever module you came from,
   * rather than flinging an Accounting user into Inventory. */
  detailBasePath?: string
  /** The Goods Receiving hub's own Reports tab already has a "Receive Stock"
   * button in its page header — showing this one too would just duplicate it.
   * Every other call site (Inventory Stock hub, Accounting) has no creation
   * entry point at all, so they keep the default. */
  showCreateButton?: boolean
}

export default function ReceivingReportsTab({
  showAmounts = false,
  detailBasePath = '/inventory/stock/reports',
  showCreateButton = true,
}: Props) {
  const router = useRouter()
  const [searchFocus, setSearchFocus] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const {
    reports,
    meta,
    page,
    limit,
    totalPages,
    isLoading,
    isFetching,
    refetch,
    summary,
    isLoadingSummary,
    warehouseOptions,
    warehousesLoading,
    supplierOptions,
    suppliersLoading,
    search,
    warehouseId,
    supplierId,
    status,
    setSearch,
    setWarehouseId,
    setSupplierId,
    setStatus,
    resetFilters,
    setPage,
  } = useReceivingReports()

  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const { data: me } = useMe()
  const canCreate = !!me && hasPermission(me, INVENTORY_PERMISSIONS.RECEIVE_CREATE)
  const canViewCost = !!me && hasPermission(me, INVENTORY_PERMISSIONS.RECEIVE_COST_VIEW)

  // Fetched lazily, only once the create modal is actually opened — a
  // manual receipt's destination is always one of the 2 real warehouses
  // (Scenario 27), and the item picker needs the full active catalogue.
  const destinationWarehousesQuery = useQuery({
    queryKey: ['inventory-warehouses-lookup', 'standalone'],
    queryFn: () => getWarehouses({ limit: 200, status: 'active', standaloneOnly: true }),
    staleTime: STALE.LOOKUP,
    enabled: isCreateOpen,
  })
  const createItemsQuery = useQuery({
    queryKey: ['inventory-items-lookup'],
    queryFn: () => getItems({ limit: 500, lifecycle: 'active' }),
    staleTime: STALE.LOOKUP,
    enabled: isCreateOpen,
  })
  const receiveMutation = useMutation({
    mutationFn: (data: ReceiveStockFormValues) => receiveStock(data),
    onSuccess: (result) => {
      if (result.success) {
        showToast({ title: 'Stock received', description: result.message, status: 'success' })
        setIsCreateOpen(false)
        queryClient.invalidateQueries({ queryKey: ['inventory-receiving-reports'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-receiving-reports-summary'] })
        queryClient.invalidateQueries({ queryKey: ['inventory-stock-balances'] })
      } else {
        showToast({
          title: 'Failed to receive stock',
          description: result.message,
          status: 'error',
        })
      }
    },
  })

  const grid = showAmounts ? GRID_WITH_AMOUNT : GRID
  const hasFilters = !!search || !!warehouseId || !!supplierId || !!status
  const total = meta?.total ?? reports.length
  const isNoResults = !isLoading && reports.length === 0

  const locationOptions = warehouseOptions.map((wh) => ({
    value: wh.id,
    label: wh.branch?.name ?? wh.name,
  }))
  const supplierSelectOptions = supplierOptions.map((s) => ({ value: s.id, label: s.name }))

  async function handleExport() {
    setIsExporting(true)
    try {
      // The visible table is one page — an export should cover everything
      // the current filters match, not just what happens to be on screen.
      const result = await getReceivingReports({
        page: 1,
        limit: 1000,
        search: search || undefined,
        warehouseId,
        supplierId,
        status,
      })
      if (!result.success || !result.data) {
        showToast({
          title: 'Export failed',
          description: result.message ?? 'Could not load receiving reports to export.',
          status: 'error',
        })
        return
      }
      const rows = result.data.data.map((r) => [
        r.code,
        fmtDate(r.receivedAt),
        r.supplier?.name ?? '',
        receivingReportPoNumber(r) ?? '',
        r.warehouse?.branch?.name ?? r.warehouse?.name ?? '',
        r.lines.length,
        reportUnits(r),
        STATUS_META[r.status]?.label ?? r.status,
        ...(showAmounts ? [reportAmount(r) ?? ''] : []),
      ])
      downloadCsv(
        `receiving-reports-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          'Receipt No.',
          'Date',
          'Supplier',
          'PO Reference',
          'Location',
          'Lines',
          'Units',
          'Status',
          ...(showAmounts ? ['Amount'] : []),
        ],
        rows
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className={`${PLEX} flex flex-col gap-[14px] text-[#17171c] antialiased`}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-[21px] font-semibold tracking-[-0.015em]">Receiving Reports</h1>
          <p className="text-[13px] text-[#5b5b6b]">
            {showAmounts
              ? 'Goods received against purchase orders, with value and outstanding balance.'
              : 'Goods received against purchase orders, with quantities, location, and status.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg border border-[#d3d3db] bg-white px-3 py-[9px] text-[13px] font-medium text-[#17171c] hover:border-[#a3a3b2] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || reports.length === 0}
            className="flex items-center gap-2 rounded-lg border border-[#d3d3db] bg-white px-3 py-[9px] text-[13px] font-medium text-[#17171c] hover:border-[#a3a3b2] disabled:opacity-50"
          >
            <Download className={`h-3.5 w-3.5 ${isExporting ? 'animate-pulse' : ''}`} />
            Export CSV
          </button>
          {showCreateButton && !showAmounts && canCreate && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-[#5b21b6] px-4 py-[9px] text-[13px] font-medium text-white hover:bg-[#4c1a9b]"
            >
              <Plus className="h-3.5 w-3.5" />
              New Receipt
            </button>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 divide-x divide-y divide-[#e4e4e9] overflow-hidden rounded-xl border border-[#e4e4e9] bg-white sm:grid-cols-4 sm:divide-y-0">
        <StatCell
          label="Receipts"
          value={summary?.receiptsLast30Days}
          loading={isLoadingSummary}
          hint="last 30 days"
        />
        <StatCell
          label="Units Received"
          value={summary?.unitsReceivedTotal}
          loading={isLoadingSummary}
          hint="across all POs"
          tone="highlight"
        />
        <StatCell
          label="Lines Received"
          value={summary?.linesReceivedTotal}
          loading={isLoadingSummary}
          hint="across all receipts"
        />
        <StatCell
          label="Short Deliveries"
          value={summary?.shortDeliveries}
          loading={isLoadingSummary}
          hint="PO balance outstanding"
          tone="warning"
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-[10px] rounded-xl border border-[#e4e4e9] bg-white p-3">
        <div
          className={`flex h-[38px] min-w-[220px] flex-[1_1_280px] items-center gap-[9px] rounded-lg border px-3 transition-colors ${
            searchFocus ? CONTROL_CHROME.focused : CONTROL_CHROME.idle
          }`}
        >
          <Search className="h-3.25 w-3.25 shrink-0 text-[#8b8b9b]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setSearchFocus(false)}
            placeholder="Search RR no., PO no., or supplier…"
            className="min-w-0 flex-1 border-none bg-transparent p-0 text-[13px] text-[#17171c] outline-none placeholder:text-[#a3a3b2]"
          />
          {search !== '' && (
            <Tooltip label="Clear search" side="bottom" align="end">
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[#8b8b9b] hover:bg-[#f1f1f4] hover:text-[#3d3d4a]"
              >
                <X className="h-3 w-3" />
              </button>
            </Tooltip>
          )}
        </div>

        <SearchableSelect
          className="w-[170px]"
          value={status ?? ''}
          onChange={(v) => setStatus(v || undefined)}
          placeholder="All Receipts"
          chrome={CONTROL_CHROME}
          clearable
          options={STATUS_OPTIONS}
        />

        <SearchableSelect
          className="w-[180px]"
          value={warehouseId ?? ''}
          onChange={(v) => setWarehouseId(v || undefined)}
          placeholder="All Locations"
          loading={warehousesLoading}
          chrome={CONTROL_CHROME}
          clearable
          options={locationOptions}
        />

        <SearchableSelect
          className="w-[180px]"
          value={supplierId ?? ''}
          onChange={(v) => setSupplierId(v || undefined)}
          placeholder="All Suppliers"
          loading={suppliersLoading}
          chrome={CONTROL_CHROME}
          clearable
          options={supplierSelectOptions}
        />

        {isFetching && !isLoading && (
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#a3a3b2]" />
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-[11px] py-[6px] text-[12.5px] text-[#5b21b6] hover:bg-[#f1ebfb]"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-[#e4e4e9] bg-white">
        {isLoading ? (
          <div>
            <div
              className={`${grid} ${MONO} hidden border-b border-[#eeeef1] bg-[#fbfbfc] px-4 py-[9px] text-[10px] uppercase tracking-[.09em] text-[#8b8b9b] min-[1080px]:grid`}
            >
              <span>Receipt No.</span>
              <span>Supplier / PO</span>
              <span>Location</span>
              <span className="text-right">Lines</span>
              <span className="text-right">Units</span>
              {showAmounts && <span className="text-right">Amount</span>}
              <span className="text-center">Status</span>
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-t border-[#f4f4f6] px-4 py-[14px] first:border-t-0"
              >
                <SkeletonBar wide />
                <SkeletonBar />
                <div className="ml-auto h-4 w-20">
                  <SkeletonBar wide />
                </div>
              </div>
            ))}
          </div>
        ) : isNoResults ? (
          hasFilters ? (
            <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
              <ClipboardList className="h-[30px] w-[30px] text-[#c9c9d3]" />
              <div className="mt-1 text-[14px] font-semibold">No reports match</div>
              <div className="max-w-[420px] text-[12.5px] leading-[1.55] text-[#5b5b6b]">
                Nothing matches these filters. Clear one to see more of the list.
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 rounded-lg border border-[#d3d3db] bg-white px-[15px] py-[9px] text-[13px] font-medium text-[#17171c] hover:border-[#a3a3b2]"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-6 py-13 text-center">
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[#ddd0f7] bg-[#f1ebfb]">
                <ClipboardList className="h-4 w-4 text-[#5b21b6]" />
              </div>
              <div className="mt-1 text-[15px] font-semibold">No receiving reports yet</div>
              <div className="max-w-[440px] text-[12.5px] leading-[1.55] text-[#5b5b6b]">
                Receive stock against a purchase order and its report shows up here.
              </div>
            </div>
          )
        ) : (
          <>
            {/* Wide: CSS-grid table, same approach as Stock Balance — explicit
                role="table"/"row"/"cell" since the markup isn't a <table>. */}
            <div
              role="table"
              aria-label="Receiving reports"
              className={`hidden transition-opacity min-[1080px]:block ${isFetching ? 'opacity-60' : ''}`}
            >
              <div
                role="row"
                className={`${grid} ${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] px-4 py-[9px] text-[10px] uppercase tracking-[.09em] text-[#8b8b9b]`}
              >
                <span role="columnheader">Receipt No.</span>
                <span role="columnheader" className="pl-6">
                  Supplier / PO
                </span>
                <span role="columnheader">Location</span>
                <span role="columnheader" className="text-right">
                  Lines
                </span>
                <span role="columnheader" className="text-right">
                  Units
                </span>
                {showAmounts && (
                  <span role="columnheader" className="text-right">
                    Amount
                  </span>
                )}
                <span role="columnheader" className="text-center">
                  Status
                </span>
              </div>

              {reports.map((report) => {
                const meta = STATUS_META[report.status] ?? {
                  label: report.status,
                  badge: 'bg-zinc-100 text-zinc-600',
                  dot: 'bg-zinc-400',
                }
                const amount = showAmounts ? reportAmount(report) : null
                return (
                  <div
                    key={report.id}
                    role="row"
                    onClick={() => router.push(`${detailBasePath}/${report.id}`)}
                    className={`cursor-pointer border-t border-[#f4f4f6] bg-white hover:bg-[#fcfcfd] ${grid} px-4 py-[11px]`}
                  >
                    <div role="cell" className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex items-center gap-1">
                        <p className={`${MONO} truncate font-medium text-[#17171c]`}>
                          {report.code}
                        </p>
                        <CopyCodeButton code={report.code} />
                      </div>
                      <p className="text-[11px] text-[#a3a3b2]">{fmtDate(report.receivedAt)}</p>
                    </div>

                    <div role="cell" className="flex min-w-0 flex-col gap-0.5 pl-6">
                      <p className="truncate text-[12.5px] font-medium text-[#17171c]">
                        {report.supplier?.name ?? '—'}
                      </p>
                      <PoLink report={report} />
                    </div>

                    <span role="cell" className="truncate text-[12.5px] text-[#5b5b6b]">
                      {report.warehouse?.branch?.name ?? report.warehouse?.name ?? '—'}
                    </span>

                    <span role="cell" className={`${MONO} text-right text-[12.5px] text-[#8b8b9b]`}>
                      {report.lines.length}
                    </span>

                    <span
                      role="cell"
                      className={`${MONO} text-right text-[13px] font-semibold text-[#17171c]`}
                    >
                      {reportUnits(report)}
                    </span>

                    {showAmounts && (
                      <span role="cell" className="text-right text-[12.5px] text-[#17171c]">
                        {amount != null ? (
                          fmtMoney(amount)
                        ) : (
                          <span className="text-[#c9c9d3]">—</span>
                        )}
                      </span>
                    )}

                    <span role="cell" className="flex justify-center">
                      <StatusBadge
                        label={meta.label}
                        colorClassName={meta.badge}
                        dotClassName={meta.dot}
                      />
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Narrow: cards */}
            <div className="flex flex-col gap-[10px] p-3 min-[1080px]:hidden">
              {reports.map((report) => {
                const meta = STATUS_META[report.status] ?? {
                  label: report.status,
                  badge: 'bg-zinc-100 text-zinc-600',
                  dot: 'bg-zinc-400',
                }
                const amount = showAmounts ? reportAmount(report) : null
                return (
                  <div
                    key={report.id}
                    onClick={() => router.push(`${detailBasePath}/${report.id}`)}
                    className="flex cursor-pointer flex-col gap-[10px] rounded-[11px] border border-[#e4e4e9] bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-[10px]">
                      <div className="flex min-w-0 flex-col gap-[3px]">
                        <div className="flex items-center gap-1">
                          <span className={`${MONO} truncate text-[13px] font-medium`}>
                            {report.code}
                          </span>
                          <CopyCodeButton code={report.code} />
                        </div>
                        <span className="truncate text-[11.5px] text-[#8b8b9b]">
                          {fmtDate(report.receivedAt)} · {report.supplier?.name ?? '—'}
                        </span>
                        <PoLink report={report} />
                      </div>
                      <StatusBadge
                        label={meta.label}
                        colorClassName={meta.badge}
                        dotClassName={meta.dot}
                      />
                    </div>

                    <div
                      className={`grid gap-[6px] ${showAmounts ? 'grid-cols-3' : 'grid-cols-2'}`}
                    >
                      <div className="flex flex-col gap-[2px] rounded-[8px] bg-[#fbfbfc] px-2 py-[7px]">
                        <span
                          className={`${MONO} text-[9px] uppercase tracking-[.06em] text-[#8b8b9b]`}
                        >
                          Lines
                        </span>
                        <span className={`${MONO} text-[14px] font-semibold text-[#17171c]`}>
                          {report.lines.length}
                        </span>
                      </div>
                      <div className="flex flex-col gap-[2px] rounded-[8px] bg-[#fbfbfc] px-2 py-[7px]">
                        <span
                          className={`${MONO} text-[9px] uppercase tracking-[.06em] text-[#8b8b9b]`}
                        >
                          Units
                        </span>
                        <span className={`${MONO} text-[14px] font-semibold text-[#17171c]`}>
                          {reportUnits(report)}
                        </span>
                      </div>
                      {showAmounts && (
                        <div className="flex flex-col gap-[2px] rounded-[8px] bg-[#fbfbfc] px-2 py-[7px]">
                          <span
                            className={`${MONO} text-[9px] uppercase tracking-[.06em] text-[#8b8b9b]`}
                          >
                            Amount
                          </span>
                          <span className={`${MONO} text-[13px] font-semibold text-[#17171c]`}>
                            {amount != null ? fmtMoney(amount) : '—'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-[12px] text-[#5b5b6b]">
                      {report.warehouse?.branch?.name ?? report.warehouse?.name ?? '—'}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-[14px] border-t border-[#e4e4e9] bg-[#fbfbfc] px-4 py-[11px]">
              <span className="text-[11.5px] text-[#8b8b9b]">
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of{' '}
                {total.toLocaleString()} receipts
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                    className="rounded-[7px] border border-[#e4e4e9] bg-white px-[11px] py-1.5 text-[12px] text-[#17171c] disabled:text-[#a3a3b2]"
                  >
                    Previous
                  </button>
                  <span className="px-2 py-1.5 text-[12px] tabular-nums text-[#5b5b6b]">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="rounded-[7px] border border-[#d3d3db] bg-white px-[11px] py-1.5 text-[12px] text-[#17171c] hover:border-[#a3a3b2] disabled:text-[#a3a3b2]"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {canCreate && (
        <ReceiveStockModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={receiveMutation.mutateAsync}
          isSubmitting={receiveMutation.isPending}
          warehouses={destinationWarehousesQuery.data?.data?.data ?? []}
          items={createItemsQuery.data?.data?.data ?? []}
          canViewCost={canViewCost}
          title="Create Receiving Report"
          subtitle="Record what was delivered against a purchase order."
          submitLabel="Create Receiving Report"
          submittingLabel="Creating…"
        />
      )}
    </div>
  )
}
