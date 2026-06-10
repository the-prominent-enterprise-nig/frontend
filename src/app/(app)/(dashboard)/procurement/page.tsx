'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  ShoppingCart,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  Truck,
  Users,
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
  Warehouse,
  BadgeCheck,
  TrendingUp,
  ShieldAlert,
  Activity,
  type LucideIcon,
} from 'lucide-react'
import {
  purchaseRequestsApi,
  purchaseOrdersApi,
  goodsReceiptsApi,
} from '@/src/libs/api/procurement'
import { getSuppliers } from './suppliers/_actions/get-supplier-list'
import type { PurchaseRequest, PurchaseOrder, GoodsReceipt } from '@/src/schema/procurement/types'
import type { Supplier } from '@/src/schema/procurement/suppliers/types'
import type { ApiResponse } from '@/src/libs/api/client'

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return '₱0'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}₱${(abs / 1_000).toFixed(0)}K`
  return `${sign}₱${Math.round(abs).toLocaleString('en-PH')}`
}

function fmtNum(n: number) {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('en-PH')
}

function fmtDate(dateStr?: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtDateShort(dateStr?: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function isOverdue(dateStr?: string | null) {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

const PR_STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  submitted: '#0ea5e9',
  approved: '#10b981',
  rejected: '#ef4444',
  converted: '#7c3aed',
  cancelled: '#d1d5db',
}

const PO_STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  sent: '#0ea5e9',
  partially_received: '#f59e0b',
  fully_received: '#10b981',
  closed: '#7c3aed',
  cancelled: '#d1d5db',
}

const GR_STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  received: '#10b981',
  quality_hold: '#f59e0b',
  rejected: '#ef4444',
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

function statusBadgeCls(status: string) {
  if (status === 'approved' || status === 'fully_received' || status === 'received')
    return 'bg-emerald-100 text-emerald-700'
  if (status === 'submitted' || status === 'sent') return 'bg-blue-100 text-blue-700'
  if (status === 'partially_received' || status === 'quality_hold')
    return 'bg-amber-100 text-amber-700'
  if (status === 'rejected' || status === 'cancelled') return 'bg-red-100 text-red-600'
  if (status === 'converted' || status === 'closed') return 'bg-violet-100 text-violet-700'
  return 'bg-gray-100 text-gray-600'
}

function fmtStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

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
  const tot = useMemo(() => segments.reduce((s, x) => s + x.value, 0), [segments])
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  const cx = size / 2
  let accum = 0
  const arcs = segments.map((seg) => {
    const pct = tot > 0 ? seg.value / tot : 0
    const len = pct * C
    const offset = -accum
    accum += len
    return { ...seg, pct, len, offset }
  })
  if (!segments.length || tot === 0) {
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
              {arc.value} <span className="text-gray-400">({(arc.pct * 100).toFixed(0)}%)</span>
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
                {item.badge ?? fmtNum(item.value)}
              </span>
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
  icon: LucideIcon
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
      ${href ? 'hover:border-orange-200 hover:shadow-md transition-all cursor-pointer' : ''}
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-7 text-center gap-2">
      <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
        <CheckCircle className="h-4 w-4 text-orange-500" />
      </div>
      <p className="text-xs text-gray-500">{message}</p>
    </div>
  )
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INIT = {
  loaded: false,
  lastUpdated: null as Date | null,
  // PR KPIs
  totalPRs: 0,
  pendingApproval: 0,
  approvedPRs: 0,
  reorderTriggered: 0,
  // PO KPIs
  openPOs: 0,
  committedValue: 0,
  partiallyReceived: 0,
  overduePOs: 0,
  // GR / Supplier KPIs
  totalGRs: 0,
  qualityHoldCount: 0,
  activeSuppliers: 0,
  pendingOnboarding: 0,
  // Secondary
  draftPRs: 0,
  draftPOs: 0,
  receivedGRs: 0,
  totalSuppliers: 0,
  // Charts
  prStatusChart: [] as { label: string; value: number; color: string }[],
  poStatusChart: [] as { label: string; value: number; color: string; badge?: string }[],
  supplierSpendChart: [] as { label: string; value: number; color: string; badge?: string }[],
  // Tables
  recentPRs: [] as PurchaseRequest[],
  recentPOs: [] as PurchaseOrder[],
  recentGRs: [] as GoodsReceipt[],
  // Alerts
  pendingApprovalList: [] as PurchaseRequest[],
  qualityHoldList: [] as GoodsReceipt[],
  overduePOsList: [] as PurchaseOrder[],
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProcurementPage() {
  const [s, setS] = useState(INIT)
  const [spinning, setSpinning] = useState(false)

  const load = useCallback(async () => {
    setSpinning(true)
    const today = new Date()

    const settled = await Promise.allSettled([
      purchaseRequestsApi.list({ limit: 200 }), // 0
      purchaseOrdersApi.list({ limit: 200 }), // 1
      goodsReceiptsApi.list({ limit: 100 }), // 2
      getSuppliers({ limit: 200 }), // 3
    ])

    function pick(i: number): unknown {
      const r = settled[i]
      if (r.status === 'rejected') return null
      const v = r.value as ApiResponse<unknown>
      if (!v || v.success === false) return null
      return v.data ?? v
    }

    function arr<T>(i: number): T[] {
      const raw = pick(i)
      if (!raw) return []
      if (Array.isArray(raw)) return raw as T[]
      const r = raw as Record<string, unknown>
      if (Array.isArray(r.data)) return r.data as T[]
      return []
    }

    function total(i: number) {
      const raw = pick(i) as { meta?: { total?: number } } | null
      return raw?.meta?.total ?? arr(i).length
    }

    // ── Purchase Requests ─────────────────────────────────────────────────────
    const prList = arr<PurchaseRequest>(0)
    const totalPRs = total(0) || prList.length
    const pendingApproval = prList.filter((p) => p.status === 'submitted').length
    const approvedPRs = prList.filter((p) => p.status === 'approved').length
    const reorderTriggered = prList.filter((p) => p.triggeredByReorder).length
    const draftPRs = prList.filter((p) => p.status === 'draft').length

    const prStatusGroups: Record<string, number> = {}
    prList.forEach((p) => {
      prStatusGroups[p.status] = (prStatusGroups[p.status] ?? 0) + 1
    })
    const prStatusChart = Object.entries(prStatusGroups)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ label: fmtStatus(k), value: v, color: PR_STATUS_COLORS[k] ?? '#94a3b8' }))
      .sort((a, b) => b.value - a.value)

    // ── Purchase Orders ───────────────────────────────────────────────────────
    const poList = arr<PurchaseOrder>(1)
    const openPOItems = poList.filter(
      (p) => p.status === 'sent' || p.status === 'partially_received'
    )
    const openPOs = openPOItems.length
    const committedValue = openPOItems.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0)
    const partiallyReceived = poList.filter((p) => p.status === 'partially_received').length
    const overduePOsList = poList.filter(
      (p) =>
        p.expectedDeliveryDate &&
        isOverdue(p.expectedDeliveryDate) &&
        !['closed', 'cancelled', 'fully_received'].includes(p.status)
    )
    const overduePOs = overduePOsList.length
    const draftPOs = poList.filter((p) => p.status === 'draft').length

    const poStatusGroups: Record<string, { count: number; value: number }> = {}
    poList.forEach((p) => {
      if (!poStatusGroups[p.status]) poStatusGroups[p.status] = { count: 0, value: 0 }
      poStatusGroups[p.status].count++
      poStatusGroups[p.status].value += Number(p.totalAmount) || 0
    })
    const poStatusChart = Object.entries(poStatusGroups)
      .filter(([, v]) => v.count > 0)
      .map(([k, v]) => ({
        label: fmtStatus(k),
        value: v.count,
        color: PO_STATUS_COLORS[k] ?? '#94a3b8',
        badge: `${v.count} (${fmtMoney(v.value)})`,
      }))
      .sort((a, b) => b.value - a.value)

    // Supplier spend from POs
    const supplierSpend: Record<string, number> = {}
    poList.forEach((p) => {
      const name = p.supplier?.name ?? p.supplierId ?? 'Unknown'
      supplierSpend[name] = (supplierSpend[name] ?? 0) + (Number(p.totalAmount) || 0)
    })
    const supplierSpendChart = Object.entries(supplierSpend)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([label, value], i) => ({
        label,
        value,
        color: COLORS[i % COLORS.length],
        badge: fmtMoney(value),
      }))

    // ── Goods Receipts ────────────────────────────────────────────────────────
    const grList = arr<GoodsReceipt>(2)
    const totalGRs = total(2) || grList.length
    const qualityHoldList = grList.filter((g) => g.status === 'quality_hold')
    const qualityHoldCount = qualityHoldList.length
    const receivedGRs = grList.filter((g) => g.status === 'received').length

    // ── Suppliers ─────────────────────────────────────────────────────────────
    const supplierList = arr<Supplier>(3)
    const totalSuppliers = total(3) || supplierList.length
    const activeSuppliers = supplierList.filter((s) => s.status === 'active').length
    const pendingOnboarding = supplierList.filter(
      (s) => s.onboardingStatus === 'pending' || s.onboardingStatus === 'in_review'
    ).length

    // Pending approval alerts (submitted PRs, newest first)
    const pendingApprovalList = prList
      .filter((p) => p.status === 'submitted')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6)

    setS({
      loaded: true,
      lastUpdated: new Date(),
      totalPRs,
      pendingApproval,
      approvedPRs,
      reorderTriggered,
      openPOs,
      committedValue,
      partiallyReceived,
      overduePOs,
      totalGRs,
      qualityHoldCount,
      activeSuppliers,
      pendingOnboarding,
      draftPRs,
      draftPOs,
      receivedGRs,
      totalSuppliers,
      prStatusChart,
      poStatusChart,
      supplierSpendChart,
      recentPRs: [...prList]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
      recentPOs: [...poList]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
      recentGRs: [...grList]
        .sort(
          (a, b) =>
            new Date(b.createdAt ?? b.receivedAt).getTime() -
            new Date(a.createdAt ?? a.receivedAt).getTime()
        )
        .slice(0, 6),
      pendingApprovalList,
      qualityHoldList: qualityHoldList.slice(0, 6),
      overduePOsList: overduePOsList.slice(0, 6),
    })
    setSpinning(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loading = !s.loaded

  return (
    <div className="min-h-full bg-zinc-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Procurement Intelligence</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {s.lastUpdated
                ? `Updated ${s.lastUpdated.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`
                : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/procurement/purchase-requests/new"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ClipboardList className="h-3.5 w-3.5 text-gray-500" />
              New PR
            </Link>
            <Link
              href="/procurement/purchase-orders/new"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ShoppingCart className="h-3.5 w-3.5 text-gray-500" />
              New PO
            </Link>
            <button
              onClick={load}
              disabled={spinning}
              className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Row 1: Purchase Request KPIs */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            Purchase Requests
          </p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Total Requests"
              value={loading ? '—' : fmtNum(s.totalPRs)}
              sub="All purchase requests"
              icon={ClipboardList}
              iconBg="bg-sky-500"
              href="/procurement/purchase-requests"
              loading={loading}
            />
            <KpiCard
              label="Pending Approval"
              value={loading ? '—' : fmtNum(s.pendingApproval)}
              sub="Awaiting review"
              icon={Clock}
              iconBg="bg-amber-500"
              href="/procurement/purchase-requests"
              loading={loading}
              urgent={s.pendingApproval > 0}
            />
            <KpiCard
              label="Approved"
              value={loading ? '—' : fmtNum(s.approvedPRs)}
              sub="Ready for conversion"
              icon={CheckCircle}
              iconBg="bg-emerald-500"
              href="/procurement/purchase-requests"
              loading={loading}
            />
            <KpiCard
              label="Reorder-Triggered"
              value={loading ? '—' : fmtNum(s.reorderTriggered)}
              sub="Auto-generated by system"
              icon={Activity}
              iconBg="bg-violet-500"
              href="/procurement/purchase-requests"
              loading={loading}
            />
          </div>
        </div>

        {/* Row 2: Purchase Order KPIs */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            Purchase Orders
          </p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Open POs"
              value={loading ? '—' : fmtNum(s.openPOs)}
              sub="Sent + partially received"
              icon={ShoppingCart}
              iconBg="bg-blue-500"
              href="/procurement/purchase-orders"
              loading={loading}
            />
            <KpiCard
              label="Committed Value"
              value={loading ? '—' : fmtMoney(s.committedValue)}
              sub="Outstanding order value"
              icon={TrendingUp}
              iconBg="bg-indigo-500"
              href="/procurement/purchase-orders"
              loading={loading}
            />
            <KpiCard
              label="Partially Received"
              value={loading ? '—' : fmtNum(s.partiallyReceived)}
              sub="In-progress deliveries"
              icon={Truck}
              iconBg="bg-cyan-500"
              href="/procurement/purchase-orders"
              loading={loading}
            />
            <KpiCard
              label="Overdue Deliveries"
              value={loading ? '—' : fmtNum(s.overduePOs)}
              sub="Past expected delivery date"
              icon={AlertTriangle}
              iconBg="bg-red-500"
              href="/procurement/purchase-orders"
              loading={loading}
              urgent={s.overduePOs > 0}
            />
          </div>
        </div>

        {/* Row 3: Receipts & Suppliers KPIs */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            Receipts & Suppliers
          </p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Total Receipts"
              value={loading ? '—' : fmtNum(s.totalGRs)}
              sub="All goods receipts"
              icon={Warehouse}
              iconBg="bg-teal-500"
              href="/procurement/goods-receiving"
              loading={loading}
            />
            <KpiCard
              label="Quality Hold"
              value={loading ? '—' : fmtNum(s.qualityHoldCount)}
              sub="Awaiting quality clearance"
              icon={ShieldAlert}
              iconBg="bg-orange-500"
              href="/procurement/goods-receiving"
              loading={loading}
              urgent={s.qualityHoldCount > 0}
            />
            <KpiCard
              label="Active Suppliers"
              value={loading ? '—' : fmtNum(s.activeSuppliers)}
              sub={loading ? '' : `of ${fmtNum(s.totalSuppliers)} total`}
              icon={Users}
              iconBg="bg-emerald-600"
              href="/procurement/suppliers"
              loading={loading}
            />
            <KpiCard
              label="Pending Onboarding"
              value={loading ? '—' : fmtNum(s.pendingOnboarding)}
              sub="Suppliers under review"
              icon={BadgeCheck}
              iconBg="bg-purple-500"
              href="/procurement/suppliers"
              loading={loading}
              urgent={s.pendingOnboarding > 0}
            />
          </div>
        </div>

        {/* Secondary strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              {
                label: 'Draft PRs',
                val: s.draftPRs,
                href: '/procurement/purchase-requests',
                accent: 'text-gray-700',
                bg: 'bg-gray-50 border-gray-100',
              },
              {
                label: 'Draft POs',
                val: s.draftPOs,
                href: '/procurement/purchase-orders',
                accent: 'text-gray-700',
                bg: 'bg-gray-50 border-gray-100',
              },
              {
                label: 'Received GRs',
                val: s.receivedGRs,
                href: '/procurement/goods-receiving',
                accent: 'text-emerald-700',
                bg: 'bg-emerald-50 border-emerald-100',
              },
              {
                label: 'Total Suppliers',
                val: s.totalSuppliers,
                href: '/procurement/suppliers',
                accent: 'text-blue-700',
                bg: 'bg-blue-50 border-blue-100',
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

        {/* Analysis: PR status + PO status + Supplier spend */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">PR Status Breakdown</h2>
                <p className="text-xs text-gray-400">Purchase requests by status</p>
              </div>
              <Link
                href="/procurement/purchase-requests"
                className="flex items-center gap-0.5 text-xs text-orange-600 hover:text-orange-700"
              >
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="flex items-center gap-6">
                <Sk className="h-[148px] w-[148px] rounded-full" />
                <div className="space-y-2.5 flex-1">
                  {[...Array(4)].map((_, i) => (
                    <Sk key={i} className="h-4 w-full" />
                  ))}
                </div>
              </div>
            ) : (
              <DonutChart segments={s.prStatusChart} />
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">PO Status Breakdown</h2>
                <p className="text-xs text-gray-400">Purchase orders by status</p>
              </div>
              <Link
                href="/procurement/purchase-orders"
                className="flex items-center gap-0.5 text-xs text-orange-600 hover:text-orange-700"
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
            ) : s.poStatusChart.length === 0 ? (
              <EmptyState message="No purchase orders yet" />
            ) : (
              <HBarChart items={s.poStatusChart} />
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Spend by Supplier</h2>
                <p className="text-xs text-gray-400">Top suppliers by PO value</p>
              </div>
              <Link
                href="/procurement/suppliers"
                className="flex items-center gap-0.5 text-xs text-orange-600 hover:text-orange-700"
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
            ) : s.supplierSpendChart.length === 0 ? (
              <EmptyState message="No purchase orders to aggregate" />
            ) : (
              <HBarChart items={s.supplierSpendChart} />
            )}
          </div>
        </div>

        {/* Recent PRs + Recent POs */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Recent Purchase Requests */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Recent Purchase Requests</h2>
              <Link
                href="/procurement/purchase-requests"
                className="flex items-center gap-0.5 text-xs text-orange-600 hover:text-orange-700"
              >
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Sk key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : s.recentPRs.length === 0 ? (
              <EmptyState message="No purchase requests yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">
                        Code
                      </th>
                      <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">
                        Status
                      </th>
                      <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">
                        Lines
                      </th>
                      <th className="text-left py-2 text-gray-400 font-semibold uppercase tracking-wide">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {s.recentPRs.map((pr, i) => (
                      <tr key={pr.id ?? i} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-3 font-mono font-semibold text-gray-900">
                          {pr.code}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeCls(pr.status)}`}
                          >
                            {fmtStatus(pr.status)}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-gray-500">{pr.lines?.length ?? '—'}</td>
                        <td className="py-2.5 text-gray-400">{fmtDateShort(pr.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Purchase Orders */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Recent Purchase Orders</h2>
              <Link
                href="/procurement/purchase-orders"
                className="flex items-center gap-0.5 text-xs text-orange-600 hover:text-orange-700"
              >
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Sk key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : s.recentPOs.length === 0 ? (
              <EmptyState message="No purchase orders yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">
                        Code
                      </th>
                      <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">
                        Supplier
                      </th>
                      <th className="text-left py-2 pr-3 text-gray-400 font-semibold uppercase tracking-wide">
                        Status
                      </th>
                      <th className="text-right py-2 text-gray-400 font-semibold uppercase tracking-wide">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {s.recentPOs.map((po, i) => (
                      <tr key={po.id ?? i} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-3">
                          <Link
                            href={`/procurement/purchase-orders/${po.id}`}
                            className="font-mono font-semibold text-orange-700 hover:underline"
                          >
                            {po.code}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-3 text-gray-600 truncate max-w-[100px]">
                          {po.supplier?.name ?? '—'}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeCls(po.status)}`}
                          >
                            {fmtStatus(po.status)}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-semibold text-gray-900 tabular-nums">
                          {fmtMoney(Number(po.totalAmount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recent Goods Receipts */}
        {(loading || s.recentGRs.length > 0) && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Recent Goods Receipts</h2>
                <p className="text-xs text-gray-400">Latest deliveries received</p>
              </div>
              <Link
                href="/procurement/goods-receiving"
                className="flex items-center gap-0.5 text-xs text-orange-600 hover:text-orange-700"
              >
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <Sk key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {s.recentGRs.map((gr, i) => (
                  <div
                    key={gr.id ?? i}
                    className={`rounded-lg border p-3 ${gr.status === 'quality_hold' ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold text-gray-900">
                        {gr.code}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeCls(gr.status)}`}
                      >
                        {fmtStatus(gr.status)}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      PO: {gr.purchaseOrder?.code ?? gr.purchaseOrderId}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {gr.warehouse?.name ?? gr.warehouseId} ·{' '}
                      {fmtDateShort(gr.createdAt ?? gr.receivedAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Alert panels: Pending Approval + Overdue POs + Quality Hold */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Pending Approval */}
          <div className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Awaiting Approval
              </h3>
              <Link
                href="/procurement/purchase-requests"
                className="text-xs text-amber-600 hover:underline tabular-nums"
              >
                {loading ? '…' : s.pendingApproval} requests
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Sk key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : s.pendingApprovalList.length === 0 ? (
              <EmptyState message="No requests awaiting approval" />
            ) : (
              <div className="space-y-2">
                {s.pendingApprovalList.map((pr, i) => (
                  <div
                    key={pr.id ?? i}
                    className="rounded-lg border border-amber-100 bg-amber-50 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 font-mono truncate">
                          {pr.code}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {pr.lines?.length ?? 0} line{pr.lines?.length !== 1 ? 's' : ''} ·{' '}
                          {fmtDateShort(pr.createdAt)}
                        </p>
                      </div>
                      {pr.triggeredByReorder && (
                        <span className="text-[9px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full shrink-0">
                          AUTO
                        </span>
                      )}
                    </div>
                    {pr.reason && (
                      <p className="text-[10px] text-gray-500 mt-1 truncate">{pr.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overdue Deliveries */}
          <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                Overdue Deliveries
              </h3>
              <Link
                href="/procurement/purchase-orders"
                className="text-xs text-red-600 hover:underline tabular-nums"
              >
                {loading ? '…' : s.overduePOs} total
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Sk key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : s.overduePOsList.length === 0 ? (
              <EmptyState message="No overdue deliveries" />
            ) : (
              <div className="space-y-2">
                {s.overduePOsList.map((po, i) => (
                  <Link
                    key={po.id ?? i}
                    href={`/procurement/purchase-orders/${po.id}`}
                    className="block rounded-lg border border-red-100 bg-red-50 p-2.5 hover:border-red-200 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-900 font-mono">{po.code}</p>
                      <span className="text-[10px] font-bold text-red-600">
                        {fmtMoney(Number(po.totalAmount))}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                      {po.supplier?.name ?? '—'}
                    </p>
                    <p className="text-[10px] text-red-500 mt-0.5">
                      Expected {fmtDateShort(po.expectedDeliveryDate)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quality Hold */}
          <div className="rounded-xl border border-orange-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold text-orange-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                Quality Hold
              </h3>
              <Link
                href="/procurement/goods-receiving"
                className="text-xs text-orange-600 hover:underline tabular-nums"
              >
                {loading ? '…' : s.qualityHoldCount} receipts
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Sk key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : s.qualityHoldList.length === 0 ? (
              <EmptyState message="No goods on quality hold" />
            ) : (
              <div className="space-y-2">
                {s.qualityHoldList.map((gr, i) => (
                  <div
                    key={gr.id ?? i}
                    className="rounded-lg border border-orange-100 bg-orange-50 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-900 font-mono">{gr.code}</p>
                      <span className="text-[9px] font-bold bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-full">
                        HOLD
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      PO: {gr.purchaseOrder?.code ?? gr.purchaseOrderId}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {gr.warehouse?.name ?? gr.warehouseId} ·{' '}
                      {fmtDateShort(gr.createdAt ?? gr.receivedAt)}
                    </p>
                  </div>
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                { label: 'Suppliers', href: '/procurement/suppliers', icon: Users },
                {
                  label: 'Purchase Requests',
                  href: '/procurement/purchase-requests',
                  icon: ClipboardList,
                },
                {
                  label: 'Purchase Orders',
                  href: '/procurement/purchase-orders',
                  icon: ShoppingCart,
                },
                { label: 'Goods Receiving', href: '/procurement/goods-receiving', icon: Warehouse },
              ] as const
            ).map(({ label, href, icon: Icon }, i) => (
              <Link
                key={i}
                href={href}
                className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2.5 text-xs font-medium text-gray-700 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 transition-all"
              >
                <Icon className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
