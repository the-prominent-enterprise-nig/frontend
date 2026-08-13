'use client'

import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useUIShell } from '@/src/stores/ui-shell.store'
import {
  Package,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowUpRight,
  Ban,
  Calendar,
  BarChart2,
  Activity,
  Layers,
  Truck,
  DollarSign,
  ShieldAlert,
  Snowflake,
  ChevronRight,
  Warehouse,
  Tag,
  ClipboardCheck,
  Tags,
} from 'lucide-react'

import { getItems } from '@/src/app/(app)/(dashboard)/inventory/items/_actions/get-items'
import { getReorderAlerts } from '@/src/app/(app)/(dashboard)/inventory/reorder/_actions/get-reorder-alerts'
import { getValuationReport } from '@/src/app/(app)/(dashboard)/inventory/reports/_actions/get-valuation-report'
import { getTurnoverReport } from '@/src/app/(app)/(dashboard)/inventory/reports/_actions/get-turnover-report'
import { getAgingReport } from '@/src/app/(app)/(dashboard)/inventory/reports/_actions/get-aging-report'
import { getTransfers } from '@/src/app/(app)/(dashboard)/inventory/transfers/_actions/get-transfers'
import { getProjection } from '@/src/app/(app)/(dashboard)/inventory/projection/_actions/get-projection'
import { getStockoutAlerts } from '@/src/app/(app)/(dashboard)/inventory/projection/_actions/get-stockout-alerts'
import { getExpiringBatches } from '@/src/app/(app)/(dashboard)/inventory/batches/_actions/get-batches'
import { getStockBalances } from '@/src/app/(app)/(dashboard)/inventory/stock/_actions/get-stock-balances'
import { getWarehouses } from '@/src/app/(app)/(dashboard)/inventory/warehouses/_actions/get-warehouses'
import { getReservations } from '@/src/app/(app)/(dashboard)/inventory/reservations/_actions/get-reservations'
import { getNegativeStockViolations } from '@/src/app/(app)/(dashboard)/inventory/negative-stock/_actions/get-negative-stock-violations'
import { getBackorders } from '@/src/app/(app)/(dashboard)/inventory/backorders/_actions/get-backorders'
import { getReturns } from '@/src/app/(app)/(dashboard)/inventory/returns/_actions/get-returns'
import { getPurchaseRequests } from '@/src/app/(app)/(dashboard)/inventory/purchase-requests/_actions/get-purchase-requests'
import { getPurchaseOrders } from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_actions/get-purchase-orders'
import { getAdjustments } from '@/src/app/(app)/(dashboard)/inventory/adjustments/_actions/get-adjustments'

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return '₱0'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `₱${(n / 1_000).toFixed(0)}K`
  return `₱${Math.round(n).toLocaleString('en-PH')}`
}

function fmtNum(n: number) {
  if (!Number.isFinite(n)) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString('en-PH')
}

function daysFromNow(dateStr?: string | null) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function fmtDate(dateStr?: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

const COLORS = [
  '#7c3aed',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#22c55e',
  '#f97316',
  '#ec4899',
]

// ── DonutChart ────────────────────────────────────────────────────────────────

function DonutChart({
  segments,
  size = 148,
  stroke = 22,
}: {
  segments: { label: string; value: number; color: string }[]
  size?: number
  stroke?: number
}) {
  const total = useMemo(() => segments.reduce((s, x) => s + x.value, 0), [segments])
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  const cx = size / 2

  let accum = 0
  const arcs = segments.map((seg) => {
    const pct = total > 0 ? seg.value / total : 0
    const len = pct * C
    const offset = -accum
    accum += len
    return { ...seg, pct, len, offset }
  })

  if (segments.length === 0 || total === 0) {
    return (
      <div className="flex h-[148px] items-center justify-center">
        <p className="text-xs text-gray-400 italic">No data available</p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} className="shrink-0 -rotate-90">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {arcs.map((arc, i) =>
          arc.len > 0.5 ? (
            <circle
              key={i}
              cx={cx}
              cy={cx}
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={stroke}
              strokeDasharray={`${arc.len} ${C}`}
              strokeDashoffset={arc.offset}
              style={{ transition: 'stroke-dasharray 0.7s ease-out' }}
            />
          ) : null
        )}
      </svg>
      <div className="min-w-0 flex-1 space-y-2">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: arc.color }}
            />
            <span className="text-xs text-gray-600 truncate flex-1">{arc.label}</span>
            <span className="text-xs font-semibold text-gray-900 tabular-nums shrink-0">
              {(arc.pct * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── HBarChart ─────────────────────────────────────────────────────────────────

function HBarChart({
  items,
}: {
  items: { label: string; value: number; color: string; badge?: string }[]
}) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1 gap-2">
            <span className="text-xs text-gray-600 truncate">{item.label}</span>
            <div className="shrink-0 flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-900 tabular-nums">
                {fmtNum(item.value)}
              </span>
              {item.badge && <span className="text-xs text-gray-400">{item.badge}</span>}
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color,
                transition: 'width 0.7s ease-out',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconBg,
  href,
  loading,
  urgent,
}: {
  label: string
  value: string
  sub?: string
  icon: any
  iconBg: string
  href?: string
  loading?: boolean
  urgent?: boolean
}) {
  const inner = (
    <div
      className={`
      rounded-xl border bg-white p-5 shadow-sm
      ${urgent ? 'border-red-200 bg-red-50/30' : 'border-gray-200'}
      ${href ? 'hover:border-violet-200 hover:shadow-md transition-all cursor-pointer' : ''}
    `}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className="h-[18px] w-[18px] text-white" />
        </div>
        {href && <ArrowUpRight className="h-3.5 w-3.5 text-gray-300" />}
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="h-2.5 w-14 rounded bg-gray-200 animate-pulse" />
          <div className="h-7 w-20 rounded bg-gray-200 animate-pulse" />
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            {label}
          </p>
          <p
            className={`mt-0.5 text-2xl font-bold tabular-nums ${urgent ? 'text-red-700' : 'text-gray-900'}`}
          >
            {value}
          </p>
          {sub && <p className="mt-0.5 text-[11px] text-gray-400 truncate">{sub}</p>}
        </div>
      )}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

// ── Micro-components ──────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className ?? ''}`} />
}

function AlertRow({
  urgency,
  left,
  right,
}: {
  urgency: 'critical' | 'warning' | 'neutral'
  left: React.ReactNode
  right: React.ReactNode
}) {
  const bg =
    urgency === 'critical'
      ? 'bg-red-50 border-red-100'
      : urgency === 'warning'
        ? 'bg-amber-50 border-amber-100'
        : 'bg-gray-50 border-gray-100'
  return (
    <div className={`rounded-lg border p-2.5 ${bg}`}>
      <div className="flex items-start justify-between gap-2">
        {left}
        <div className="shrink-0 text-right">{right}</div>
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-7 text-center gap-2">
      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
        <TrendingUp className="h-4 w-4 text-green-600" />
      </div>
      <p className="text-xs text-gray-500">{message}</p>
    </div>
  )
}

// ── Initial state (type inferred from shape) ──────────────────────────────────

const INIT = {
  loaded: false,
  lastUpdated: null as Date | null,
  totalValue: 0,
  totalSkus: 0,
  activeWarehouses: 0,
  reservedQty: 0,
  totalOnHand: 0,
  totalAvailableQty: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  expiringSoonCount: 0,
  projectedStockouts: 0,
  trendingTowardReorderCount: 0,
  slowMovingCount: 0,
  deadStockCount: 0,
  inTransitCount: 0,
  activeBackorders: 0,
  negativeViolations: 0,
  returnsCount: 0,
  openPrCount: 0,
  openPoCount: 0,
  valuationByCategory: [] as { label: string; value: number; color: string }[],
  valuationByWarehouse: [] as { label: string; value: number; color: string; badge?: string }[],
  agingBreakdown: [] as { label: string; value: number; color: string }[],
  abcSegments: [] as { label: string; value: number; color: string }[],
  reorderAlertsList: [] as any[],
  stockoutAlertsList: [] as any[],
  trendingTowardReorderList: [] as any[],
  expiringBatchesList: [] as any[],
  recentTransfersList: [] as any[],
  transferStatusCounts: {} as Record<string, number>,
  negativeViolationsList: [] as any[],
  backordersList: [] as any[],
  purchasingActivityList: [] as any[],
  pendingAdjustmentsList: [] as any[],
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { pushPanel } = useUIShell()

  const load = useCallback(async () => {
    const settled = await Promise.allSettled([
      getItems({ limit: 1 }), // 0
      getReorderAlerts({ limit: 200 }), // 1
      getValuationReport({ limit: 1 }), // 2 — only the pre-aggregated `summary` is used, not `data`
      getTurnoverReport({ periodDays: 90 }), // 3
      getTransfers({ limit: 20 }), // 4
      getProjection({ days: 30 }), // 5
      getStockoutAlerts({ days: 30 }), // 6
      getExpiringBatches({ days: 30, limit: 20 }), // 7
      getStockBalances({ limit: 1 }), // 8 — only the pre-aggregated `summary` is used, not `data`
      getWarehouses({ status: 'active', limit: 50 }), // 9
      getReservations({ limit: 1 }), // 10 — only the pre-aggregated `summary` is used, not `data`
      getNegativeStockViolations({ limit: 50 }), // 11
      getBackorders({ limit: 50 }), // 12
      getReturns({ limit: 20 }), // 13
      getAgingReport(), // 14
      getPurchaseRequests({ limit: 50 }), // 15
      getPurchaseOrders({ limit: 50 }), // 16
      getAdjustments({ limit: 50 }), // 17
    ])

    function pick(i: number): any {
      const r = settled[i]
      if (r.status === 'rejected') return null
      if (!r.value?.success) return null
      return r.value.data
    }

    function arr(i: number): any[] {
      const raw = pick(i)
      if (!raw) return []
      if (Array.isArray(raw)) return raw
      if (Array.isArray(raw.data)) return raw.data
      return []
    }

    function total(i: number) {
      const raw = pick(i)
      if (!raw) return 0
      if (typeof raw.total === 'number') return raw.total
      if (Array.isArray(raw)) return raw.length
      if (Array.isArray(raw.data)) return raw.total ?? raw.data.length
      return 0
    }

    // Items
    const itemsRaw = pick(0)
    const totalSkus = itemsRaw?.total ?? itemsRaw?.meta?.total ?? 0

    // Reorder alerts
    const alertList = arr(1)
    const lowStockCount = total(1)
    const outOfStockCount = alertList.filter((a) => a.currentAvailableQty === 0).length

    // Valuation — category/warehouse breakdown now comes pre-aggregated from
    // the backend (reports.service.ts's groupValuationRows), so this no
    // longer needs to fetch every row just to reduce it client-side.
    const valuationRaw = pick(2)
    const totalValue = valuationRaw?.summary?.totalValue ?? valuationRaw?.grandTotal ?? 0

    const valuationByCategory = ((valuationRaw?.summary?.byCategory ?? []) as any[])
      .slice()
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 8)
      .map((c, i) => ({ label: c.category, value: c.totalValue, color: COLORS[i % COLORS.length] }))
    const valuationByWarehouse = ((valuationRaw?.summary?.byWarehouse ?? []) as any[])
      .slice()
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 8)
      .map((w, i) => ({
        label: w.warehouseName,
        value: w.totalValue,
        color: COLORS[(i + 2) % COLORS.length],
        badge: fmtMoney(w.totalValue),
      }))

    // Turnover / ABC classification
    const turnoverRaw = pick(3)
    const turnoverItems = turnoverRaw?.data ?? []
    const slowMovingCount =
      turnoverRaw?.summary?.slowMoving ??
      turnoverItems.filter((t: any) => t.status === 'slow_moving').length
    const deadStockCount =
      turnoverRaw?.summary?.deadStock ??
      turnoverItems.filter((t: any) => t.status === 'dead_stock').length
    const healthyCount = turnoverItems.filter((t: any) => t.status === 'healthy').length

    // Real days-since-last-movement aging (distinct from Turnover's
    // projected days-of-supply, which was being mislabeled as this before).
    const agingRaw = pick(14)?.summary ?? {}
    const agingBreakdown = [
      { label: '0–30 days', value: agingRaw['0_30']?.count ?? 0, color: '#10b981' },
      { label: '31–60 days', value: agingRaw['31_60']?.count ?? 0, color: '#f59e0b' },
      { label: '61–90 days', value: agingRaw['61_90']?.count ?? 0, color: '#f97316' },
      { label: '90+ days', value: agingRaw['90_plus']?.count ?? 0, color: '#ef4444' },
    ]
    const abcSegments = [
      { label: 'Healthy', value: healthyCount, color: '#10b981' },
      { label: 'Slow Moving', value: slowMovingCount, color: '#f59e0b' },
      { label: 'Dead Stock', value: deadStockCount, color: '#ef4444' },
    ]

    // Transfers — counted from the full fetched list, not the sliced
    // "recent 8" used for the list below, so the pill strip covers every
    // transfer regardless of how many are shown underneath.
    const transferList = arr(4)
    const inTransitCount = transferList.filter((t) => t.status === 'in_transit').length
    const transferStatusCounts: Record<string, number> = {}
    transferList.forEach((t) => {
      transferStatusCounts[t.status] = (transferStatusCounts[t.status] ?? 0) + 1
    })

    // Stockouts
    const stockoutList = arr(6)
    const projectedStockouts = total(6)

    // Trending toward reorder — the full forward projection (distinct from
    // both Low Stock Items, which flags items already below their reorder
    // point today, and Projected Stockouts above, which flags items headed
    // to zero). This flags items projected to cross their reorder point
    // within the window but not already stocked out — an earlier warning
    // tier that was previously computed and simply never surfaced anywhere.
    const projectionRaw = pick(5)
    const projectionItems = (projectionRaw?.items ?? []) as any[]
    const trendingTowardReorderList = projectionItems.filter(
      (i) => i.atReorderLevel && !i.projectedStockout
    )
    const trendingTowardReorderCount = trendingTowardReorderList.length

    // Expiry
    const expiryList = arr(7)
    const expiringSoonCount = total(7)

    // Stock balances — totals now come pre-aggregated from the backend
    // (stock.service.ts's getBalances `summary` block), computed from the
    // full filtered set before pagination, so this no longer needs to fetch
    // every row just to sum them client-side.
    const balanceRaw = pick(8)
    const totalOnHand = balanceRaw?.summary?.totalOnHandQty ?? 0
    const totalAvailableQty = balanceRaw?.summary?.totalAvailableQty ?? 0

    // Warehouses
    const warehouseList = arr(9)
    const activeWarehouses = total(9) || warehouseList.length

    // Reservations — primary source for reserved qty (stock balance field is
    // often unpopulated). Backend ignores pagination and always returns
    // every reservation, so the summary (computed from the full set in
    // get-reservations.ts) is used instead of fetching+summing rows here.
    const reservedFromReservations = pick(10)?.summary?.totalReservedQty ?? 0
    const reservedFromBalances = balanceRaw?.summary?.totalReservedQty ?? 0
    const reservedQty = reservedFromReservations || reservedFromBalances || total(10)

    // Negative stock
    const negativeList = arr(11)
    const negativeViolations = total(11)

    // Backorders
    const backorderList = arr(12)
    const activeBackorders = backorderList.filter((b) => b.status === 'pending').length || total(12)

    // Returns
    const returnsCount = total(13)

    // Purchasing — open PRs (awaiting approval or approved-but-not-yet-
    // converted) and open POs (not yet fully received/closed/cancelled).
    // Real volume is small (single digits today), so a plain fetch + client
    // filter is fine here — no need for a backend aggregate at this scale.
    const prList = arr(15)
    const openPrList = prList.filter((pr) => ['submitted', 'approved'].includes(pr.status))
    const poList = arr(16)
    const openPoList = poList.filter(
      (po) => !['fully_received', 'closed', 'cancelled'].includes(po.status)
    )
    const purchasingActivityList = [
      ...openPrList.map((pr) => ({
        type: 'PR' as const,
        id: pr.id,
        code: pr.code,
        status: pr.status,
        date: pr.submittedAt ?? pr.createdAt,
        amount: null as number | null,
      })),
      ...openPoList.map((po) => ({
        type: 'PO' as const,
        id: po.id,
        code: po.code,
        status: po.status,
        date: po.orderDate ?? po.createdAt,
        amount: Number(po.totalAmount ?? 0),
      })),
    ]
      .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
      .slice(0, 6)

    // Stock Adjustments awaiting resolution — a real approve/reject/
    // investigate workflow (Scenario 19) that had zero dashboard visibility.
    // "Pending" = anywhere before the terminal approved/rejected states.
    const adjustmentList = arr(17)
    const pendingAdjustmentsList = adjustmentList.filter((a) =>
      ['submitted', 'confirmed', 'investigating'].includes(a.status)
    )

    return {
      loaded: true,
      lastUpdated: new Date(),
      totalValue,
      totalSkus,
      activeWarehouses,
      reservedQty,
      totalOnHand,
      totalAvailableQty,
      lowStockCount,
      outOfStockCount,
      expiringSoonCount,
      projectedStockouts,
      trendingTowardReorderCount,
      slowMovingCount,
      deadStockCount,
      inTransitCount,
      activeBackorders,
      negativeViolations,
      returnsCount,
      openPrCount: openPrList.length,
      openPoCount: openPoList.length,
      valuationByCategory,
      valuationByWarehouse,
      agingBreakdown,
      abcSegments,
      reorderAlertsList: alertList.slice(0, 10),
      stockoutAlertsList: stockoutList.slice(0, 8),
      trendingTowardReorderList: trendingTowardReorderList.slice(0, 8),
      expiringBatchesList: expiryList.slice(0, 8),
      recentTransfersList: transferList.slice(0, 8),
      transferStatusCounts,
      negativeViolationsList: negativeList.slice(0, 6),
      backordersList: backorderList.slice(0, 8),
      purchasingActivityList,
      pendingAdjustmentsList: pendingAdjustmentsList.slice(0, 8),
    }
  }, [])

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['inventory-dashboard'],
    queryFn: load,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    // Just under the poll interval — avoids an extra full refetch if the
    // user navigates away and back to this page within a normal 30s cycle.
    staleTime: 20_000,
  })
  const s = data ?? INIT

  const loading = !s.loaded

  return (
    <div className="min-h-full bg-zinc-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Inventory Intelligence</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {s.lastUpdated
                ? `Updated ${s.lastUpdated.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`
                : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/inventory/reports"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5 text-gray-500" />
              Reports
            </Link>
            <Link
              href="/inventory/items"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Package className="h-3.5 w-3.5 text-gray-500" />
              All Items
            </Link>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Row 1: Primary KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Total Inventory Value"
            value={loading ? '—' : fmtMoney(s.totalValue)}
            sub={loading ? '' : `${fmtNum(s.totalOnHand)} units on hand`}
            icon={DollarSign}
            iconBg="bg-violet-600"
            href="/inventory/reports"
            loading={loading}
          />
          <KpiCard
            label="Total SKUs"
            value={loading ? '—' : fmtNum(s.totalSkus)}
            sub="Active catalog"
            icon={Package}
            iconBg="bg-blue-500"
            href="/inventory/items"
            loading={loading}
          />
          <KpiCard
            label="Active Warehouses"
            value={loading ? '—' : String(s.activeWarehouses)}
            sub={loading ? '' : `${fmtNum(s.totalAvailableQty)} available units`}
            icon={Warehouse}
            iconBg="bg-emerald-500"
            href="/inventory/warehouses"
            loading={loading}
          />
          <KpiCard
            label="Reserved Stock"
            value={loading ? '—' : fmtNum(s.reservedQty)}
            sub="Units held for orders"
            icon={Layers}
            iconBg="bg-cyan-500"
            href="/inventory/reservations"
            loading={loading}
          />
        </div>

        {/* Row 2: Risk KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Low Stock Items"
            value={loading ? '—' : fmtNum(s.lowStockCount)}
            sub={loading ? '' : `${s.outOfStockCount} out of stock`}
            icon={AlertTriangle}
            iconBg="bg-amber-500"
            href="/inventory/reorder"
            loading={loading}
            urgent={s.lowStockCount > 0}
          />
          <KpiCard
            label="Expiring Soon"
            value={loading ? '—' : fmtNum(s.expiringSoonCount)}
            sub="Batches within 30 days"
            icon={Calendar}
            iconBg="bg-orange-500"
            href="/inventory/batches"
            loading={loading}
            urgent={s.expiringSoonCount > 0}
          />
          <KpiCard
            label="Projected Stockouts"
            value={loading ? '—' : fmtNum(s.projectedStockouts)}
            sub="In next 30 days"
            icon={TrendingDown}
            iconBg="bg-rose-600"
            href="/inventory/projection"
            loading={loading}
            urgent={s.projectedStockouts > 0}
          />
          <KpiCard
            label="Negative Violations"
            value={loading ? '—' : fmtNum(s.negativeViolations)}
            sub="Stock below zero"
            icon={Ban}
            iconBg="bg-red-600"
            href="/inventory/negative-stock"
            loading={loading}
            urgent={s.negativeViolations > 0}
          />
        </div>

        {/* Row 3: Movement KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Slow Moving"
            value={loading ? '—' : fmtNum(s.slowMovingCount)}
            sub="Low velocity items (90d)"
            icon={Snowflake}
            iconBg="bg-sky-500"
            href="/inventory/reports"
            loading={loading}
          />
          <KpiCard
            label="Dead Stock"
            value={loading ? '—' : fmtNum(s.deadStockCount)}
            sub="No recent movement"
            icon={Activity}
            iconBg="bg-gray-500"
            href="/inventory/reports"
            loading={loading}
          />
          <KpiCard
            label="In Transit"
            value={loading ? '—' : fmtNum(s.inTransitCount)}
            sub="Active transfers"
            icon={Truck}
            iconBg="bg-indigo-500"
            href="/inventory/transfers"
            loading={loading}
          />
          <KpiCard
            label="Active Backorders"
            value={loading ? '—' : fmtNum(s.activeBackorders)}
            sub="Pending fulfillment"
            icon={Clock}
            iconBg="bg-purple-500"
            href="/inventory/backorders"
            loading={loading}
          />
        </div>

        {/* Secondary metrics strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              {
                label: 'Returns Recorded',
                val: s.returnsCount,
                href: '/inventory/returns',
                accent: 'text-blue-700',
                bg: 'bg-blue-50 border-blue-100',
              },
              {
                label: 'Out of Stock',
                val: s.outOfStockCount,
                href: '/inventory/stock-levels',
                accent: 'text-red-700',
                bg: 'bg-red-50 border-red-100',
              },
            ] as const
          ).map((m, i) => (
            <Link
              key={i}
              href={m.href}
              className={`rounded-xl border px-4 py-3 flex items-center justify-between hover:shadow-sm transition-all ${m.bg}`}
            >
              <span className="text-xs text-gray-600 font-medium">{m.label}</span>
              <span className={`text-sm font-bold tabular-nums ${m.accent}`}>
                {loading ? '—' : fmtNum(m.val)}
              </span>
            </Link>
          ))}
        </div>

        {/* Inventory Health */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Inventory Value by Category</h2>
                <p className="text-xs text-gray-400">
                  Distribution of total stock value across product categories
                </p>
              </div>
              <span className="shrink-0 text-xs font-semibold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-100">
                {loading ? '…' : fmtMoney(s.totalValue)}
              </span>
            </div>
            {loading ? (
              <div className="flex items-center gap-6">
                <Sk className="h-[148px] w-[148px] rounded-full" />
                <div className="space-y-2.5 flex-1">
                  {[...Array(5)].map((_, i) => (
                    <Sk key={i} className="h-4 w-full" />
                  ))}
                </div>
              </div>
            ) : (
              <DonutChart segments={s.valuationByCategory} />
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Stock Classification</h2>
              <p className="text-xs text-gray-400">Item health by movement velocity</p>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Sk key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {s.abcSegments.map((seg, i) => {
                    const tot = s.abcSegments.reduce((a, b) => a + b.value, 0) || 1
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium" style={{ color: seg.color }}>
                            {seg.label}
                          </span>
                          <span className="text-xs text-gray-700 font-semibold tabular-nums">
                            {fmtNum(seg.value)}{' '}
                            <span className="text-gray-400 font-normal">
                              ({Math.round((seg.value / tot) * 100)}%)
                            </span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${(seg.value / tot) * 100}%`,
                              backgroundColor: seg.color,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {s.totalOnHand > 0 && (
                  <div className="mt-5 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-600 mb-2">Stock Availability</p>
                    <div className="flex h-3 rounded-full overflow-hidden gap-px">
                      {[
                        { v: s.totalAvailableQty, c: '#10b981', t: 'Available' },
                        { v: s.reservedQty, c: '#7c3aed', t: 'Reserved' },
                        {
                          v: Math.max(0, s.totalOnHand - s.totalAvailableQty - s.reservedQty),
                          c: '#94a3b8',
                          t: 'Other',
                        },
                      ]
                        .filter((seg) => seg.v > 0)
                        .map((seg, i) => (
                          <div
                            key={i}
                            title={`${seg.t}: ${fmtNum(seg.v)}`}
                            className="h-full transition-all duration-700"
                            style={{ flex: seg.v, backgroundColor: seg.c }}
                          />
                        ))}
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="flex items-center gap-1 text-[10px] text-gray-500">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                        {fmtNum(s.totalAvailableQty)} avail
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-500">
                        <span className="h-2 w-2 rounded-full bg-violet-600 inline-block" />
                        {fmtNum(s.reservedQty)} reserved
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Aging & Warehouse */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Inventory Aging Analysis</h2>
              <p className="text-xs text-gray-400">Items by days since last movement</p>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Sk key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : s.agingBreakdown.every((a) => a.value === 0) ? (
              <div className="flex h-20 items-center justify-center text-xs text-gray-400">
                No aging data available
              </div>
            ) : (
              <HBarChart items={s.agingBreakdown} />
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Stock Value by Warehouse</h2>
                <p className="text-xs text-gray-400">Valuation distribution across locations</p>
              </div>
              <Link
                href="/inventory/warehouses"
                className="flex items-center gap-0.5 text-xs text-violet-600 hover:text-violet-700"
              >
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Sk key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : s.valuationByWarehouse.length === 0 ? (
              <div className="flex h-20 items-center justify-center text-xs text-gray-400">
                No warehouse data
              </div>
            ) : (
              <HBarChart items={s.valuationByWarehouse} />
            )}
          </div>
        </div>

        {/* Alerts & Risks */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <h2 className="text-base font-semibold text-gray-900">Alerts &amp; Risk Signals</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Projected Stockouts
                </h3>
                <Link
                  href="/inventory/projection"
                  className="text-xs text-red-600 hover:underline tabular-nums"
                >
                  {loading ? '…' : s.projectedStockouts} total
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Sk key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : s.stockoutAlertsList.length === 0 ? (
                <EmptyState message="No projected stockouts in the next 30 days" />
              ) : (
                <div className="space-y-2">
                  {s.stockoutAlertsList.map((alert, i) => {
                    const days = alert.stockoutDate
                      ? Math.ceil(
                          (new Date(alert.stockoutDate).getTime() - Date.now()) / 86_400_000
                        )
                      : null
                    const critical = days != null && days <= 7
                    return (
                      <AlertRow
                        key={i}
                        urgency={critical ? 'critical' : 'warning'}
                        left={
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() =>
                                alert.itemId &&
                                pushPanel({
                                  type: 'item360',
                                  itemId: alert.itemId,
                                  itemName: alert.name,
                                })
                              }
                              className="block w-full text-left"
                            >
                              <p className="text-xs font-semibold text-gray-900 truncate hover:text-red-700 hover:underline">
                                {alert.name ?? 'Unknown'}
                              </p>
                            </button>
                            <p className="text-[11px] text-gray-500 truncate">
                              {alert.sku} · {alert.warehouseName ?? '—'}
                            </p>
                          </div>
                        }
                        right={
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`text-sm font-bold ${critical ? 'text-red-600' : 'text-orange-600'}`}
                            >
                              {days != null ? `${days}d` : '—'}
                            </span>
                            <p className="text-[10px] text-gray-400">{alert.currentQty} on hand</p>
                            <Link
                              href="/inventory/operations?tab=receiving"
                              className="inline-flex items-center gap-0.5 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-800 hover:bg-red-200"
                            >
                              Receive
                            </Link>
                          </div>
                        }
                      />
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-yellow-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-yellow-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-yellow-500" />
                  Trending Toward Reorder
                </h3>
                <Link
                  href="/inventory/projection"
                  className="text-xs text-yellow-700 hover:underline tabular-nums"
                >
                  {loading ? '…' : s.trendingTowardReorderCount} total
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Sk key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : s.trendingTowardReorderList.length === 0 ? (
                <EmptyState message="No items trending toward reorder" />
              ) : (
                <div className="space-y-2">
                  {s.trendingTowardReorderList.map((item, i) => (
                    <AlertRow
                      key={i}
                      urgency="warning"
                      left={
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() =>
                              item.itemId &&
                              pushPanel({
                                type: 'item360',
                                itemId: item.itemId,
                                itemName: item.name,
                              })
                            }
                            className="block w-full text-left"
                          >
                            <p className="text-xs font-semibold text-gray-900 truncate hover:text-yellow-700 hover:underline">
                              {item.name ?? 'Unknown'}
                            </p>
                          </button>
                          <p className="text-[11px] text-gray-500 truncate">
                            {item.sku} · {item.warehouseName ?? '—'}
                          </p>
                        </div>
                      }
                      right={
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-bold text-yellow-700">
                            {item.projectedMinBalance}
                          </span>
                          <p className="text-[10px] text-gray-400">min projected bal.</p>
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Low Stock Warnings
                </h3>
                <Link
                  href="/inventory/reorder"
                  className="text-xs text-amber-600 hover:underline tabular-nums"
                >
                  {loading ? '…' : s.lowStockCount} total
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Sk key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : s.reorderAlertsList.length === 0 ? (
                <EmptyState message="All stock levels are healthy" />
              ) : (
                <div className="space-y-2">
                  {s.reorderAlertsList.map((alert, i) => (
                    <AlertRow
                      key={i}
                      urgency={alert.currentAvailableQty === 0 ? 'critical' : 'warning'}
                      left={
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() =>
                              alert.item?.id &&
                              pushPanel({
                                type: 'item360',
                                itemId: alert.item.id,
                                itemName: alert.item.name,
                              })
                            }
                            className="block w-full text-left"
                          >
                            <p className="text-xs font-semibold text-gray-900 truncate hover:text-amber-700 hover:underline">
                              {alert.item?.name ?? 'Unknown'}
                            </p>
                          </button>
                          <p className="text-[11px] text-gray-500">
                            {alert.item?.sku} · {alert.warehouse?.name ?? '—'}
                          </p>
                          <div className="mt-1.5 h-1 rounded-full bg-amber-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-500"
                              style={{
                                width: `${Math.min((alert.currentAvailableQty / Math.max(alert.reorderPoint, 1)) * 100, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      }
                      right={
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`text-sm font-bold ${alert.currentAvailableQty === 0 ? 'text-red-600' : 'text-amber-700'}`}
                          >
                            {alert.currentAvailableQty}
                          </span>
                          <p className="text-[10px] text-gray-400">reorder: {alert.reorderPoint}</p>
                          <Link
                            href="/inventory/operations?tab=receiving"
                            className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-200"
                          >
                            Receive
                          </Link>
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  Expiring Soon
                </h3>
                <Link
                  href="/inventory/batches"
                  className="text-xs text-orange-600 hover:underline tabular-nums"
                >
                  {loading ? '…' : s.expiringSoonCount} total
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Sk key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : s.expiringBatchesList.length === 0 ? (
                <EmptyState message="No batches expiring within 30 days" />
              ) : (
                <div className="space-y-2">
                  {s.expiringBatchesList.map((batch, i) => {
                    const days = daysFromNow(batch.expiryDate)
                    const critical = days != null && days <= 7
                    return (
                      <AlertRow
                        key={i}
                        urgency={critical ? 'critical' : 'warning'}
                        left={
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">
                              {batch.item?.name ?? 'Unknown'}
                            </p>
                            <p className="text-[11px] text-gray-500">Batch #{batch.batchNumber}</p>
                          </div>
                        }
                        right={
                          <>
                            <span
                              className={`text-sm font-bold ${critical ? 'text-red-600' : 'text-orange-700'}`}
                            >
                              {days != null ? `${days}d` : '—'}
                            </span>
                            <p className="text-[10px] text-gray-400">{fmtDate(batch.expiryDate)}</p>
                          </>
                        }
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Operations & Movement */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Operations &amp; Movement</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-indigo-500" />
                  Transfer Activity
                </h3>
                <Link
                  href="/inventory/transfers"
                  className="flex items-center gap-0.5 text-xs text-violet-600 hover:text-violet-700"
                >
                  View all <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex gap-1.5 mb-3 flex-wrap">
                {loading ? (
                  <>
                    <Sk className="h-5 w-20 rounded-full" />
                    <Sk className="h-5 w-20 rounded-full" />
                    <Sk className="h-5 w-20 rounded-full" />
                  </>
                ) : (
                  (
                    [
                      {
                        key: 'pending_manager_approval',
                        label: 'Mgr Approval',
                        cls: 'bg-amber-100 text-amber-700',
                      },
                      { key: 'requested', label: 'Requested', cls: 'bg-blue-100 text-blue-700' },
                      {
                        key: 'pending_hq_approval',
                        label: 'HQ Approval',
                        cls: 'bg-orange-100 text-orange-700',
                      },
                      { key: 'rejected', label: 'Rejected', cls: 'bg-rose-100 text-rose-700' },
                      { key: 'draft', label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
                      {
                        key: 'in_transit',
                        label: 'In Transit',
                        cls: 'bg-indigo-100 text-indigo-700',
                      },
                      {
                        key: 'partially_received',
                        label: 'Partial',
                        cls: 'bg-teal-100 text-teal-700',
                      },
                      { key: 'received', label: 'Received', cls: 'bg-green-100 text-green-700' },
                      { key: 'cancelled', label: 'Cancelled', cls: 'bg-red-100 text-red-600' },
                    ] as const
                  )
                    // Only show statuses that actually have transfers right
                    // now — with 9 possible statuses, always rendering all
                    // of them (mostly at 0) reads as cluttered.
                    .filter(({ key }) => (s.transferStatusCounts[key] ?? 0) > 0)
                    .map(({ key, label, cls }) => (
                      <span
                        key={key}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}
                      >
                        {s.transferStatusCounts[key]} {label}
                      </span>
                    ))
                )}
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Sk key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : s.recentTransfersList.length === 0 ? (
                <div className="py-5 text-center text-xs text-gray-400">No recent transfers</div>
              ) : (
                <div className="space-y-1">
                  {s.recentTransfersList.map((t, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          t.status === 'in_transit'
                            ? 'bg-indigo-500'
                            : t.status === 'received'
                              ? 'bg-green-500'
                              : t.status === 'cancelled'
                                ? 'bg-red-400'
                                : 'bg-gray-400'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-900 truncate">
                          {t.fromWarehouse?.name ?? '?'} → {t.toWarehouse?.name ?? '?'}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {t._count?.lines ?? 0} line{t._count?.lines !== 1 ? 's' : ''} ·{' '}
                          {fmtDate(t.transferDate)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-medium capitalize rounded-full px-2 py-0.5 ${
                          t.status === 'in_transit'
                            ? 'bg-indigo-50 text-indigo-700'
                            : t.status === 'received'
                              ? 'bg-green-50 text-green-700'
                              : t.status === 'cancelled'
                                ? 'bg-red-50 text-red-600'
                                : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-violet-500" />
                  Purchasing
                </h3>
              </div>
              <div className="flex gap-1.5 mb-3">
                <Link
                  href="/inventory/purchase-requests"
                  className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-200"
                >
                  {loading ? '—' : s.openPrCount} Open PR{s.openPrCount === 1 ? '' : 's'}
                </Link>
                <Link
                  href="/inventory/purchase-orders"
                  className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-200"
                >
                  {loading ? '—' : s.openPoCount} Open PO{s.openPoCount === 1 ? '' : 's'}
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Sk key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : s.purchasingActivityList.length === 0 ? (
                <div className="py-5 text-center text-xs text-gray-400">
                  No open purchase requests or orders
                </div>
              ) : (
                <div className="space-y-1">
                  {s.purchasingActivityList.map((p, i) => (
                    <Link
                      key={i}
                      href={
                        p.type === 'PR'
                          ? '/inventory/purchase-requests'
                          : '/inventory/purchase-orders'
                      }
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          p.type === 'PR'
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {p.type}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-900 truncate">{p.code}</p>
                        <p className="text-[11px] text-gray-400 capitalize">
                          {String(p.status).replace('_', ' ')} · {fmtDate(p.date)}
                        </p>
                      </div>
                      {p.amount != null && (
                        <span className="shrink-0 text-xs font-semibold text-gray-700">
                          {fmtMoney(p.amount)}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Planning */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-500" />
                Active Backorders
              </h3>
              <Link
                href="/inventory/backorders"
                className="flex items-center gap-0.5 text-xs text-violet-600 hover:text-violet-700"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Sk key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : s.backordersList.length === 0 ? (
              <EmptyState message="No active backorders" />
            ) : (
              <div className="space-y-2">
                {s.backordersList.map((b, i) => {
                  const days = daysFromNow(b.commitmentDate)
                  const overdue = days != null && days < 0
                  return (
                    <AlertRow
                      key={i}
                      urgency={overdue ? 'critical' : 'neutral'}
                      left={
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">
                            {b.item?.name ?? 'Unknown'}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            SO {b.salesOrderId.slice(0, 8)}… · {b.backorderedQty} units
                          </p>
                        </div>
                      }
                      right={
                        <>
                          <span
                            className={`text-xs font-bold ${overdue ? 'text-red-600' : 'text-gray-700'}`}
                          >
                            {overdue
                              ? `${Math.abs(days!)}d overdue`
                              : days != null
                                ? `${days}d`
                                : '—'}
                          </span>
                          <p className="text-[10px] text-gray-400 capitalize">
                            {b.status.replace('_', ' ')}
                          </p>
                        </>
                      }
                    />
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-500" />
                Negative Stock Violations
              </h3>
              <Link
                href="/inventory/negative-stock"
                className="flex items-center gap-0.5 text-xs text-violet-600 hover:text-violet-700"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Sk key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : s.negativeViolationsList.length === 0 ? (
              <EmptyState message="No negative stock violations" />
            ) : (
              <div className="space-y-2">
                {s.negativeViolationsList.map((v, i) => (
                  <AlertRow
                    key={i}
                    urgency="critical"
                    left={
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {v.itemName ?? 'Unknown'}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {v.warehouseName ?? '—'} · {v.sku ?? ''}
                        </p>
                      </div>
                    }
                    right={<span className="text-sm font-bold text-red-600">{v.onHandQty}</span>}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-teal-500" />
                Adjustments Pending Investigation
              </h3>
              <Link
                href="/inventory/counting"
                className="flex items-center gap-0.5 text-xs text-violet-600 hover:text-violet-700"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Sk key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : s.pendingAdjustmentsList.length === 0 ? (
              <EmptyState message="No adjustments pending investigation" />
            ) : (
              <div className="space-y-2">
                {s.pendingAdjustmentsList.map((a, i) => (
                  <AlertRow
                    key={i}
                    urgency={a.status === 'submitted' ? 'warning' : 'critical'}
                    left={
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {a.adjustmentNumber ?? 'Unknown'}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {a.warehouse?.name ?? '—'} ·{' '}
                          {String(a.reasonCode ?? '').replace('_', ' ')}
                        </p>
                      </div>
                    }
                    right={
                      <span className="text-[11px] font-medium capitalize text-teal-700">
                        {a.status}
                      </span>
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Navigation */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
            Module Navigation
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {(
              [
                { label: 'Stock Balances', href: '/inventory/stock', icon: BarChart2 },
                {
                  label: 'Goods Receiving',
                  href: '/inventory/operations?tab=receiving',
                  icon: Package,
                },
                { label: 'Stock Counts', href: '/inventory/counting', icon: Layers },
                {
                  label: 'Stock Adjustments',
                  href: '/inventory/counting?tab=adjustments',
                  icon: ClipboardCheck,
                },
                { label: 'Quality Hold', href: '/inventory/quality-hold', icon: ShieldAlert },
                { label: 'Revaluation', href: '/inventory/revaluation', icon: TrendingUp },
                { label: 'Price Lists', href: '/inventory/price-lists', icon: Tag },
                { label: 'Price Use Types', href: '/inventory/price-use-types', icon: Tags },
              ] as const
            ).map(({ label, href, icon: Icon }, i) => (
              <Link
                key={i}
                href={href}
                className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2.5 text-xs font-medium text-gray-700 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 transition-all"
              >
                <Icon className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
