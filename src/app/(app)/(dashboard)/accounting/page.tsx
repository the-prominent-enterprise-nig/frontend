'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  FileText,
  Receipt,
  BarChart2,
  Activity,
  ChevronRight,
  Building2,
  CreditCard,
  Wallet,
  Clock,
  Scale,
  BookOpen,
  ShieldAlert,
  CalendarDays,
  Repeat,
  PieChart,
} from 'lucide-react'
import {
  Reports,
  ARInvoices,
  APBills,
  BankAccounts,
  FixedAssetsV2,
  FiscalPeriods,
  Budgets,
} from '@/src/libs/data/AccountingV2Data'

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

function fmtPct(n: number) {
  if (!Number.isFinite(n)) return '0%'
  return `${n.toFixed(1)}%`
}

function fmtDate(dateStr?: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function daysOverdue(dueDate?: string | null) {
  if (!dueDate) return 0
  return Math.max(0, Math.ceil((Date.now() - new Date(dueDate).getTime()) / 86_400_000))
}

function statusCls(status?: string) {
  const u = status?.toUpperCase()
  if (u === 'PAID') return 'bg-green-100 text-green-700'
  if (u === 'OVERDUE') return 'bg-red-100 text-red-700'
  if (u === 'PARTIAL') return 'bg-orange-100 text-orange-700'
  if (u === 'VOID') return 'bg-gray-100 text-gray-500'
  if (u === 'SENT' || u === 'RECEIVED') return 'bg-blue-100 text-blue-700'
  if (u === 'DRAFT') return 'bg-zinc-100 text-zinc-500'
  return 'bg-yellow-100 text-yellow-700'
}

function statusLabel(status?: string) {
  const u = status?.toUpperCase()
  if (u === 'PAID') return 'Paid'
  if (u === 'OVERDUE') return 'Overdue'
  if (u === 'PARTIAL') return 'Partial'
  if (u === 'VOID') return 'Void'
  if (u === 'SENT') return 'Sent'
  if (u === 'RECEIVED') return 'Received'
  if (u === 'DRAFT') return 'Draft'
  return status ?? 'Pending'
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

// ── AgingBuckets helper ───────────────────────────────────────────────────────

function extractAging(raw: any) {
  if (!raw) return []
  const buckets: { label: string; value: number; color: string; badge: string }[] = []
  const BUCKET_COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#dc2626']
  const BUCKET_KEYS = [
    { key: 'current', label: 'Current' },
    { key: '1-30', label: '1–30 days' },
    { key: '31-60', label: '31–60 days' },
    { key: '61-90', label: '61–90 days' },
    { key: '90+', label: '90+ days' },
  ]
  if (Array.isArray(raw.buckets)) {
    return raw.buckets.map((b: any, i: number) => ({
      label: b.label ?? b.period ?? `Bucket ${i + 1}`,
      value: Number(b.balance ?? b.amount ?? b.total ?? 0),
      color: BUCKET_COLORS[i] ?? '#94a3b8',
      badge: fmtMoney(Number(b.balance ?? b.amount ?? 0)),
    }))
  }
  BUCKET_KEYS.forEach(({ key, label }, i) => {
    const bucket = raw[key] ?? raw.summary?.[key]
    if (bucket == null) return
    const val = Number(
      typeof bucket === 'object' ? (bucket.balance ?? bucket.amount ?? bucket.total ?? 0) : bucket
    )
    if (val > 0) buckets.push({ label, value: val, color: BUCKET_COLORS[i], badge: fmtMoney(val) })
  })
  return buckets
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
                {fmtMoney(item.value)}
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

// ── Initial state ─────────────────────────────────────────────────────────────

const INIT = {
  loaded: false,
  lastUpdated: null as Date | null,
  // P&L
  totalRevenue: 0,
  totalExpenses: 0,
  netIncome: 0,
  grossMarginPct: 0,
  // Balance sheet
  totalAssets: 0,
  totalLiabilities: 0,
  totalEquity: 0,
  // Cash
  totalCash: 0,
  // AR
  arOutstanding: 0,
  openInvoicesCount: 0,
  overdueInvoicesCount: 0,
  // AP
  apOutstanding: 0,
  openBillsCount: 0,
  overdueBillsCount: 0,
  // Fixed assets
  activeAssetsCount: 0,
  totalBookValue: 0,
  // Period
  openPeriodName: null as string | null,
  // Budget alerts count
  budgetAlertCount: 0,
  // Charts
  pnlBreakdown: [] as { label: string; value: number; color: string }[],
  arAgingBuckets: [] as { label: string; value: number; color: string; badge?: string }[],
  apAgingBuckets: [] as { label: string; value: number; color: string; badge?: string }[],
  bankBreakdown: [] as { label: string; value: number; color: string; badge?: string }[],
  recentInvoices: [] as any[],
  recentBills: [] as any[],
  overdueInvoicesList: [] as any[],
  overdueBillsList: [] as any[],
  budgetAlerts: [] as any[],
  bankAccountsList: [] as any[],
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const [s, setS] = useState(INIT)
  const [spinning, setSpinning] = useState(false)

  const load = useCallback(async () => {
    setSpinning(true)
    const today = new Date().toISOString().slice(0, 10)
    const yearStart = `${new Date().getFullYear()}-01-01`
    const fiscalYear = new Date().getFullYear()

    const settled = await Promise.allSettled([
      Reports.pnl(yearStart, today), // 0
      Reports.biSummary(), // 1
      Reports.balanceSheet(), // 2
      Reports.aging('ar'), // 3
      Reports.aging('ap'), // 4
      ARInvoices.list(), // 5
      APBills.list(), // 6
      BankAccounts.list(), // 7
      FixedAssetsV2.list(), // 8
      FiscalPeriods.list(), // 9
      Budgets.variance(fiscalYear), // 10
    ])

    function pick(i: number): any {
      const r = settled[i]
      if (r.status === 'rejected') return null
      const v = r.value
      if (!v || v.success === false) return null
      return v.data ?? v
    }

    function arr(i: number): any[] {
      const raw = pick(i)
      if (!raw) return []
      if (Array.isArray(raw)) return raw
      if (Array.isArray(raw.items)) return raw.items
      if (Array.isArray(raw.data)) return raw.data
      return []
    }

    // ── P&L ──────────────────────────────────────────────────────────────────
    const pnl = pick(0)
    const totalRevenue = Number(pnl?.totalRevenue ?? pnl?.revenue ?? pnl?.data?.totalRevenue ?? 0)
    const totalCogs = Number(pnl?.totalCogs ?? pnl?.data?.totalCogs ?? 0)
    const totalOpEx = Number(pnl?.totalOpEx ?? pnl?.expenses ?? pnl?.data?.totalOpEx ?? 0)
    const totalExpenses =
      totalCogs + totalOpEx || Number(pnl?.totalExpenses ?? pnl?.data?.totalExpenses ?? 0)
    const netIncome = Number(
      pnl?.netIncome ?? pnl?.netProfit ?? pnl?.data?.netIncome ?? totalRevenue - totalExpenses
    )
    const grossMarginPct = totalRevenue > 0 ? ((totalRevenue - totalCogs) / totalRevenue) * 100 : 0

    // ── BI Summary ────────────────────────────────────────────────────────────
    const bi = pick(1)
    const arFromBI = Number(bi?.arOutstanding ?? bi?.data?.arOutstanding ?? 0)
    const apFromBI = Number(bi?.apOutstanding ?? bi?.data?.apOutstanding ?? 0)

    // ── Balance Sheet ─────────────────────────────────────────────────────────
    const bs = pick(2)
    const totalAssets = Number(bs?.totalAssets ?? bs?.data?.totalAssets ?? bs?.assets?.total ?? 0)
    const totalLiabilities = Number(
      bs?.totalLiabilities ?? bs?.data?.totalLiabilities ?? bs?.liabilities?.total ?? 0
    )
    const totalEquity = Number(bs?.totalEquity ?? bs?.data?.totalEquity ?? bs?.equity?.total ?? 0)

    // ── AR / AP Aging ─────────────────────────────────────────────────────────
    const arAgingBuckets = extractAging(pick(3))
    const apAgingBuckets = extractAging(pick(4))

    // ── AR Invoices ───────────────────────────────────────────────────────────
    const invoiceList = arr(5)
    const now = new Date()
    const isOverdue = (doc: any) => {
      const st = doc.status?.toUpperCase()
      return (
        st === 'OVERDUE' ||
        (doc.dueDate && new Date(doc.dueDate) < now && st !== 'PAID' && st !== 'VOID')
      )
    }
    const overdueInvoicesList = invoiceList.filter(isOverdue)
    const openInvoicesCount = invoiceList.filter((inv) => {
      const st = inv.status?.toUpperCase()
      return st !== 'PAID' && st !== 'VOID'
    }).length
    const arFromInvoices = invoiceList
      .filter((inv) => inv.status?.toUpperCase() !== 'PAID' && inv.status?.toUpperCase() !== 'VOID')
      .reduce(
        (sum, inv) => sum + ((Number(inv.totalAmount) || 0) - (Number(inv.amountPaid) || 0)),
        0
      )
    const arOutstanding = arFromBI || arFromInvoices

    // ── AP Bills ──────────────────────────────────────────────────────────────
    const billList = arr(6)
    const overdueBillsList = billList.filter(isOverdue)
    const openBillsCount = billList.filter((bill) => {
      const st = bill.status?.toUpperCase()
      return st !== 'PAID' && st !== 'VOID'
    }).length
    const apFromBills = billList
      .filter(
        (bill) => bill.status?.toUpperCase() !== 'PAID' && bill.status?.toUpperCase() !== 'VOID'
      )
      .reduce(
        (sum, bill) => sum + ((Number(bill.totalAmount) || 0) - (Number(bill.amountPaid) || 0)),
        0
      )
    const apOutstanding = apFromBI || apFromBills

    // ── Bank Accounts ─────────────────────────────────────────────────────────
    const bankList = arr(7)
    const totalCash = bankList.reduce((sum, b) => sum + (Number(b.currentBalance) || 0), 0)
    const bankBreakdown = bankList
      .filter((b) => b.isActive !== false)
      .slice(0, 6)
      .map((b, i) => ({
        label: b.name ?? b.bankName,
        value: Number(b.currentBalance) || 0,
        color: COLORS[i % COLORS.length],
        badge: b.currencyCode,
      }))

    // ── Fixed Assets ──────────────────────────────────────────────────────────
    const assetList = arr(8)
    const activeAssetsCount = assetList.filter((a) => a.status === 'ACTIVE').length
    const totalBookValue = assetList.reduce((sum, a) => sum + (Number(a.bookValue) || 0), 0)

    // ── Fiscal Periods ────────────────────────────────────────────────────────
    const periodList = arr(9)
    const openPeriod = periodList.find((p) => p.status === 'OPEN')
    const openPeriodName = openPeriod?.name ?? null

    // ── Budget Variance ───────────────────────────────────────────────────────
    const varianceList = arr(10)
    const budgetAlerts = varianceList.filter((v: any) => v.alertTriggered || v.warnTriggered)

    // ── P&L Breakdown chart ───────────────────────────────────────────────────
    const pnlBreakdown = [
      { label: 'COGS', value: totalCogs, color: '#f59e0b' },
      { label: 'Op. Expenses', value: totalOpEx, color: '#ef4444' },
      { label: 'Net Income', value: Math.max(0, netIncome), color: '#10b981' },
    ].filter((seg) => seg.value > 0)

    setS({
      loaded: true,
      lastUpdated: new Date(),
      totalRevenue,
      totalExpenses,
      netIncome,
      grossMarginPct,
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalCash,
      arOutstanding,
      openInvoicesCount,
      overdueInvoicesCount: overdueInvoicesList.length,
      apOutstanding,
      openBillsCount,
      overdueBillsCount: overdueBillsList.length,
      activeAssetsCount,
      totalBookValue,
      openPeriodName,
      budgetAlertCount: budgetAlerts.length,
      pnlBreakdown,
      arAgingBuckets,
      apAgingBuckets,
      bankBreakdown,
      recentInvoices: invoiceList.slice(0, 8),
      recentBills: billList.slice(0, 8),
      overdueInvoicesList: overdueInvoicesList.slice(0, 6),
      overdueBillsList: overdueBillsList.slice(0, 6),
      budgetAlerts: budgetAlerts.slice(0, 6),
      bankAccountsList: bankList.slice(0, 4),
    })
    setSpinning(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const loading = !s.loaded

  const netPositive = s.netIncome >= 0

  return (
    <div className="min-h-full bg-zinc-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Financial Intelligence</h1>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {s.lastUpdated
                ? `Updated ${s.lastUpdated.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`
                : 'Loading…'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/accounting/reports"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5 text-gray-500" />
              Reports
            </Link>
            <Link
              href="/accounting/journal-entries"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5 text-gray-500" />
              Journal
            </Link>
            <button
              onClick={load}
              disabled={spinning}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Row 1: P&L KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Total Revenue"
            value={loading ? '—' : fmtMoney(s.totalRevenue)}
            sub="Year to date"
            icon={TrendingUp}
            iconBg="bg-emerald-500"
            href="/accounting/reports?tab=pnl"
            loading={loading}
          />
          <KpiCard
            label="Total Expenses"
            value={loading ? '—' : fmtMoney(s.totalExpenses)}
            sub="COGS + operating expenses"
            icon={Receipt}
            iconBg="bg-orange-500"
            href="/accounting/reports?tab=pnl"
            loading={loading}
          />
          <KpiCard
            label="Net Profit / Loss"
            value={loading ? '—' : fmtMoney(s.netIncome)}
            sub={loading ? '' : netPositive ? 'Profitable year to date' : 'Net loss year to date'}
            icon={netPositive ? TrendingUp : TrendingDown}
            iconBg={netPositive ? 'bg-violet-600' : 'bg-red-500'}
            href="/accounting/reports?tab=pnl"
            loading={loading}
            urgent={!loading && !netPositive}
          />
          <KpiCard
            label="Gross Margin"
            value={loading ? '—' : fmtPct(s.grossMarginPct)}
            sub="Revenue minus COGS"
            icon={PieChart}
            iconBg="bg-cyan-500"
            href="/accounting/reports?tab=pnl"
            loading={loading}
          />
        </div>

        {/* Row 2: Balance Sheet KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Total Assets"
            value={loading ? '—' : fmtMoney(s.totalAssets)}
            sub="From balance sheet"
            icon={Building2}
            iconBg="bg-blue-500"
            href="/accounting/reports?tab=balance-sheet"
            loading={loading}
          />
          <KpiCard
            label="Total Liabilities"
            value={loading ? '—' : fmtMoney(s.totalLiabilities)}
            sub="From balance sheet"
            icon={Scale}
            iconBg="bg-amber-500"
            href="/accounting/reports?tab=balance-sheet"
            loading={loading}
          />
          <KpiCard
            label="Cash on Hand"
            value={loading ? '—' : fmtMoney(s.totalCash)}
            sub={
              loading
                ? ''
                : `${s.bankAccountsList.length} bank account${s.bankAccountsList.length !== 1 ? 's' : ''}`
            }
            icon={Wallet}
            iconBg="bg-teal-500"
            href="/accounting/bank-accounts"
            loading={loading}
          />
          <KpiCard
            label="Fixed Assets"
            value={loading ? '—' : fmtMoney(s.totalBookValue)}
            sub={loading ? '' : `${s.activeAssetsCount} active assets`}
            icon={Building2}
            iconBg="bg-indigo-500"
            href="/accounting/fixed-assets"
            loading={loading}
          />
        </div>

        {/* Row 3: AR / AP KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="AR Outstanding"
            value={loading ? '—' : fmtMoney(s.arOutstanding)}
            sub={loading ? '' : `${s.openInvoicesCount} open invoices`}
            icon={FileText}
            iconBg="bg-sky-500"
            href="/accounting/ar-invoices"
            loading={loading}
          />
          <KpiCard
            label="Overdue Invoices"
            value={loading ? '—' : fmtNum(s.overdueInvoicesCount)}
            sub="Past due date"
            icon={AlertTriangle}
            iconBg="bg-red-500"
            href="/accounting/ar-invoices"
            loading={loading}
            urgent={s.overdueInvoicesCount > 0}
          />
          <KpiCard
            label="AP Outstanding"
            value={loading ? '—' : fmtMoney(s.apOutstanding)}
            sub={loading ? '' : `${s.openBillsCount} open bills`}
            icon={CreditCard}
            iconBg="bg-purple-500"
            href="/accounting/ap-bills"
            loading={loading}
          />
          <KpiCard
            label="Overdue Bills"
            value={loading ? '—' : fmtNum(s.overdueBillsCount)}
            sub="Past due date"
            icon={ShieldAlert}
            iconBg="bg-rose-600"
            href="/accounting/ap-bills"
            loading={loading}
            urgent={s.overdueBillsCount > 0}
          />
        </div>

        {/* Secondary strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              {
                label: 'Open Invoices',
                val: s.openInvoicesCount,
                href: '/accounting/ar-invoices',
                accent: 'text-sky-700',
                bg: 'bg-sky-50 border-sky-100',
              },
              {
                label: 'Open Bills',
                val: s.openBillsCount,
                href: '/accounting/ap-bills',
                accent: 'text-purple-700',
                bg: 'bg-purple-50 border-purple-100',
              },
              {
                label: 'Budget Alerts',
                val: s.budgetAlertCount,
                href: '/accounting/budgets',
                accent: s.budgetAlertCount > 0 ? 'text-red-700' : 'text-gray-700',
                bg:
                  s.budgetAlertCount > 0
                    ? 'bg-red-50 border-red-100'
                    : 'bg-gray-50 border-gray-100',
              },
              {
                label: 'Active Period',
                display: s.openPeriodName ?? '—',
                href: '/accounting/fiscal-periods',
                accent: s.openPeriodName ? 'text-emerald-700' : 'text-gray-400',
                bg: 'bg-emerald-50 border-emerald-100',
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
                {loading ? '—' : 'display' in m ? m.display : fmtNum(m.val)}
              </span>
            </Link>
          ))}
        </div>

        {/* Analysis: P&L breakdown + AR aging + AP aging */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">P&amp;L Breakdown</h2>
              <p className="text-xs text-gray-400">Revenue allocation — year to date</p>
            </div>
            {loading ? (
              <div className="flex items-center gap-6">
                <Sk className="h-[148px] w-[148px] rounded-full" />
                <div className="space-y-2.5 flex-1">
                  {[...Array(3)].map((_, i) => (
                    <Sk key={i} className="h-4 w-full" />
                  ))}
                </div>
              </div>
            ) : (
              <DonutChart segments={s.pnlBreakdown} />
            )}
            {!loading && (
              <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Revenue</p>
                  <p className="text-sm font-bold text-emerald-700">{fmtMoney(s.totalRevenue)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Net Income</p>
                  <p
                    className={`text-sm font-bold ${netPositive ? 'text-violet-700' : 'text-red-600'}`}
                  >
                    {fmtMoney(s.netIncome)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">AR Aging</h2>
                <p className="text-xs text-gray-400">Receivables by days outstanding</p>
              </div>
              <Link
                href="/accounting/ar-invoices"
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
            ) : s.arAgingBuckets.length === 0 ? (
              <EmptyState message="No AR aging data available" />
            ) : (
              <HBarChart items={s.arAgingBuckets} />
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">AP Aging</h2>
                <p className="text-xs text-gray-400">Payables by days outstanding</p>
              </div>
              <Link
                href="/accounting/ap-bills"
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
            ) : s.apAgingBuckets.length === 0 ? (
              <EmptyState message="No AP aging data available" />
            ) : (
              <HBarChart items={s.apAgingBuckets} />
            )}
          </div>
        </div>

        {/* Bank Accounts */}
        {(loading || s.bankBreakdown.length > 0) && (
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Bank Account Balances</h2>
                <p className="text-xs text-gray-400">Current balances across all active accounts</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-full border border-violet-100">
                  {loading ? '…' : fmtMoney(s.totalCash)} total
                </span>
                <Link
                  href="/accounting/bank-accounts"
                  className="flex items-center gap-0.5 text-xs text-violet-600 hover:text-violet-700"
                >
                  All <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
            {loading ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <Sk key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {s.bankAccountsList.map((bank, i) => (
                  <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <p className="text-xs text-gray-500 truncate">{bank.bankName}</p>
                    </div>
                    <p className="text-xs font-medium text-gray-700 truncate">{bank.name}</p>
                    <p className="text-sm font-bold text-gray-900 tabular-nums mt-0.5">
                      {fmtMoney(Number(bank.currentBalance) || 0)}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {bank.currencyCode} · {bank.accountType}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Operations: AR Invoices + AP Bills */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Recent Transactions</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-500" />
                  AR Invoices
                </h3>
                <Link
                  href="/accounting/ar-invoices"
                  className="flex items-center gap-0.5 text-xs text-violet-600 hover:text-violet-700"
                >
                  View all <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Sk key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : s.recentInvoices.length === 0 ? (
                <EmptyState message="No invoices found" />
              ) : (
                <div className="space-y-1">
                  {s.recentInvoices.map((inv, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {inv.customer
                            ? `${inv.customer.firstName ?? ''} ${inv.customer.lastName ?? ''}`.trim()
                            : inv.customerId}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {inv.invoiceNumber} · {fmtDate(inv.invoiceDate)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-gray-900 tabular-nums">
                          {fmtMoney(Number(inv.totalAmount) || 0)}
                        </p>
                        <span
                          className={`text-[10px] font-medium capitalize rounded-full px-1.5 py-0.5 ${statusCls(inv.status)}`}
                        >
                          {statusLabel(inv.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-purple-500" />
                  AP Bills
                </h3>
                <Link
                  href="/accounting/ap-bills"
                  className="flex items-center gap-0.5 text-xs text-violet-600 hover:text-violet-700"
                >
                  View all <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Sk key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : s.recentBills.length === 0 ? (
                <EmptyState message="No bills found" />
              ) : (
                <div className="space-y-1">
                  {s.recentBills.map((bill, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {bill.vendor?.name ?? bill.vendorId}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {bill.billNumber} · {fmtDate(bill.billDate)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-gray-900 tabular-nums">
                          {fmtMoney(Number(bill.totalAmount) || 0)}
                        </p>
                        <span
                          className={`text-[10px] font-medium capitalize rounded-full px-1.5 py-0.5 ${statusCls(bill.status)}`}
                        >
                          {statusLabel(bill.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Alerts: Overdue + Budget */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <h2 className="text-base font-semibold text-gray-900">Alerts &amp; Risk Signals</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Overdue Invoices */}
            <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Overdue Receivables
                </h3>
                <Link
                  href="/accounting/ar-invoices"
                  className="text-xs text-red-600 hover:underline tabular-nums"
                >
                  {loading ? '…' : s.overdueInvoicesCount} total
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Sk key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : s.overdueInvoicesList.length === 0 ? (
                <EmptyState message="No overdue receivables" />
              ) : (
                <div className="space-y-2">
                  {s.overdueInvoicesList.map((inv, i) => {
                    const days = daysOverdue(inv.dueDate)
                    return (
                      <div key={i} className="rounded-lg border border-red-100 bg-red-50 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">
                              {inv.customer
                                ? `${inv.customer.firstName ?? ''} ${inv.customer.lastName ?? ''}`.trim()
                                : inv.customerId}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              {inv.invoiceNumber} · Due {fmtDate(inv.dueDate)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-bold text-gray-900">
                              {fmtMoney(Number(inv.totalAmount) - Number(inv.amountPaid))}
                            </p>
                            <p className="text-[10px] text-red-600 font-medium">{days}d overdue</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Budget Alerts */}
            <div className="rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Budget Variance Alerts
                </h3>
                <Link
                  href="/accounting/budgets"
                  className="text-xs text-amber-600 hover:underline tabular-nums"
                >
                  {loading ? '…' : s.budgetAlertCount} alerts
                </Link>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Sk key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : s.budgetAlerts.length === 0 ? (
                <EmptyState message="All budgets within thresholds" />
              ) : (
                <div className="space-y-2">
                  {s.budgetAlerts.map((v, i) => {
                    const isAlert = v.alertTriggered
                    return (
                      <div
                        key={i}
                        className={`rounded-lg border p-2.5 ${isAlert ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">
                              {v.account?.name ?? v.account?.number ?? 'Unknown Account'}
                            </p>
                            <div className="mt-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isAlert ? 'bg-red-500' : 'bg-amber-500'}`}
                                style={{ width: `${Math.min(v.usedPct ?? 0, 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p
                              className={`text-xs font-bold ${isAlert ? 'text-red-700' : 'text-amber-700'}`}
                            >
                              {v.usedPct != null ? `${v.usedPct.toFixed(0)}%` : '—'}
                            </p>
                            <p className="text-[10px] text-gray-400">of budget</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Overdue Bills */}
        {(loading || s.overdueBillsList.length > 0) && (
          <div className="rounded-xl border border-rose-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                Overdue Payables
              </h3>
              <Link
                href="/accounting/ap-bills"
                className="text-xs text-rose-600 hover:underline tabular-nums"
              >
                {loading ? '…' : s.overdueBillsCount} total
              </Link>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <Sk key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {s.overdueBillsList.map((bill, i) => {
                  const days = daysOverdue(bill.dueDate)
                  return (
                    <div key={i} className="rounded-lg border border-rose-100 bg-rose-50 p-2.5">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {bill.vendor?.name ?? bill.vendorId}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {bill.billNumber} · Due {fmtDate(bill.dueDate)}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-bold text-gray-900">
                          {fmtMoney(Number(bill.totalAmount) - Number(bill.amountPaid))}
                        </span>
                        <span className="text-[10px] text-rose-600 font-medium">
                          {days}d overdue
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Quick Navigation */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
            Module Navigation
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {(
              [
                { label: 'AR Invoices', href: '/accounting/ar-invoices', icon: FileText },
                { label: 'AP Bills', href: '/accounting/ap-bills', icon: CreditCard },
                { label: 'Journal Entries', href: '/accounting/journal-entries', icon: BookOpen },
                {
                  label: 'Chart of Accounts',
                  href: '/accounting/chart-of-accounts',
                  icon: BarChart2,
                },
                { label: 'Bank Recon', href: '/accounting/bank-reconciliation', icon: Wallet },
                { label: 'Fixed Assets', href: '/accounting/fixed-assets', icon: Building2 },
                { label: 'Budgets', href: '/accounting/budgets', icon: Scale },
                { label: 'Fiscal Periods', href: '/accounting/fiscal-periods', icon: CalendarDays },
                { label: 'Tax', href: '/accounting/tax', icon: Receipt },
                { label: 'Currencies', href: '/accounting/currencies', icon: DollarSign },
                { label: 'Recurring', href: '/accounting/recurring-entries', icon: Repeat },
                { label: 'Reports', href: '/accounting/reports', icon: Clock },
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
