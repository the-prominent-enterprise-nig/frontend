'use client'

import {
  Gauge,
  TrendingUp,
  FileWarning,
  AlertCircle,
  Users,
  Briefcase,
  UserCog,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { useWidgetSize } from '../WidgetSizeContext'
import { CARD_SHADOW_RESTING, CARD_SHADOW_HOVER } from '../DashboardWidgetWrapper'
import {
  useDashboardArInvoices,
  useDashboardSalesByBranch,
  useDashboardCustomersTotal,
  useDashboardEnterpriseSummary,
  useNeedsAttentionItems,
} from './dashboardQueries'

type Tone = 'default' | 'warn' | 'good'

type Kpi = {
  label: string
  value: string
  sub: string
  icon: LucideIcon
  tone: Tone
  /** Navigates to another page. Mutually exclusive with onClick. */
  href?: string
  /** Jumps to another widget on this same dashboard (e.g. scroll-into-view). */
  onClick?: () => void
}

/** Lower-priority stat shown as a plain inline line, not a full tile —
 * headcount changes rarely and isn't part of the daily pulse the 4 main
 * tiles cover, so giving it equal visual weight just competed for
 * attention instead of adding it. */
type SecondaryStat = {
  label: string
  value: string
  icon: LucideIcon
  href: string
}

/** Scrolls the Needs Attention widget into view if it's currently on the dashboard. */
function scrollToNeedsAttention(): void {
  document.getElementById('widget-needs-attention')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(0)}K`
  return `₱${Math.round(n).toLocaleString()}`
}

const TONE_CARD: Record<Tone, string> = {
  default: 'border-zinc-100 bg-white',
  warn: 'border-amber-200 bg-amber-50/50',
  good: 'border-emerald-200 bg-emerald-50/50',
}
const TONE_ICON: Record<Tone, string> = {
  default: 'text-blue-600 bg-blue-50',
  warn: 'text-amber-600 bg-amber-100',
  good: 'text-emerald-600 bg-emerald-100',
}

// Top-of-dashboard KPI strip for the Business Owner view — the 4 numbers an
// owner scans first. Deliberately all-time/current-state rather than
// "today"/"this month": demo and early-stage real data both tend to be
// sparse and unevenly dated, so a narrow rolling window reads as "broken"
// (all zeros) long before it reads as "quiet." Sales by Branch below still
// offers a recent-window view for trend-watching once there's enough history.
export default function HeroKpiStripWidget() {
  const branchId = usePosBranchContext((s) => s.branchId)
  const { variant } = useWidgetSize()
  // Only the widest tier gets 4 columns — these labels ("Outstanding AR",
  // "Needs Attention") are longer than Module Stats' short module names, so
  // they need more room per tile before 4-across stops wrapping mid-word.
  const isCompact = variant !== 'lg'

  // Each of these hooks shares its cache (by query key) with whichever other
  // widget needs the same data — see dashboardQueries.ts. React Query fires
  // the underlying request once per unique key, however many widgets ask.
  const salesQuery = useDashboardSalesByBranch(undefined)
  const arInvoicesQuery = useDashboardArInvoices(branchId ?? undefined)
  const customersQuery = useDashboardCustomersTotal(1)
  const attentionQuery = useNeedsAttentionItems(branchId ?? undefined)
  const enterpriseQuery = useDashboardEnterpriseSummary()

  const loaded =
    salesQuery.data !== undefined &&
    arInvoicesQuery.data !== undefined &&
    customersQuery.data !== undefined &&
    attentionQuery.data !== undefined

  function buildKpis(): Kpi[] {
    const branches = salesQuery.data ?? []
    const totalRevenue = branches.reduce((s, b) => s + b.totalSales, 0)
    const totalTxns = branches.reduce((s, b) => s + b.transactionCount, 0)

    const invoices = arInvoicesQuery.data ?? []
    const outstanding = invoices.reduce(
      (s, i) => s + Math.max(0, (i.totalAmount ?? 0) - (i.amountPaid ?? 0)),
      0
    )
    const overdueCount = invoices.filter((i) => i.isOverdue).length

    const totalCustomers = customersQuery.data ?? 0
    const attentionItems = attentionQuery.data ?? []
    const urgentCount = attentionItems.filter((a) => a.tier === 1).length

    return [
      {
        label: 'Total Revenue',
        value: fmtMoney(totalRevenue),
        sub: `${totalTxns} transaction${totalTxns === 1 ? '' : 's'}`,
        icon: TrendingUp,
        tone: 'default',
        href: '/pos/transactions',
      },
      {
        label: 'Outstanding AR',
        value: fmtMoney(outstanding),
        sub: overdueCount > 0 ? `${overdueCount} overdue` : 'None overdue',
        icon: FileWarning,
        tone: overdueCount > 0 ? 'warn' : 'good',
        href: '/accounting/ar-invoices',
      },
      {
        label: 'Needs Attention',
        value: String(attentionItems.length),
        sub:
          urgentCount > 0
            ? `${urgentCount} urgent`
            : attentionItems.length > 0
              ? 'All routine'
              : 'All caught up',
        icon: AlertCircle,
        tone: attentionItems.length === 0 ? 'good' : urgentCount > 0 ? 'warn' : 'default',
        onClick: scrollToNeedsAttention,
      },
      {
        label: 'Customers',
        value: String(totalCustomers),
        sub: 'Across all branches',
        icon: Users,
        tone: 'default',
        href: '/crm',
      },
    ]
  }

  const kpis: Kpi[] | null = loaded ? buildKpis() : null

  const secondaryStats: SecondaryStat[] | null = enterpriseQuery.data
    ? [
        {
          label: 'Employees',
          value: String(enterpriseQuery.data.employeeCount ?? 0),
          icon: Briefcase,
          href: '/settings',
        },
        {
          label: 'System Users',
          value: String(enterpriseQuery.data.userCount ?? 0),
          icon: UserCog,
          href: '/settings',
        },
      ]
    : null

  const heading = (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 shrink-0 text-zinc-400" />
        <p className="text-sm font-semibold text-zinc-800">Overview</p>
      </div>
      {secondaryStats && secondaryStats.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {secondaryStats.map((stat) => {
            const Icon = stat.icon
            return (
              <Link
                key={stat.label}
                href={stat.href}
                className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-purple-600"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <span className="font-semibold text-zinc-700">{stat.value}</span>
                <span>{stat.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )

  if (!kpis) {
    return (
      <div>
        {heading}
        <div className={`grid gap-3 ${isCompact ? 'grid-cols-2' : 'grid-cols-4'}`}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[86px] rounded-xl bg-zinc-100 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {heading}
      <div className={`grid gap-3 ${isCompact ? 'grid-cols-2' : 'grid-cols-4'}`}>
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          const cardClass = `block rounded-xl border p-3.5 text-left transition-all duration-300 ${CARD_SHADOW_RESTING} ${CARD_SHADOW_HOVER} hover:-translate-y-0.5 ${TONE_CARD[kpi.tone]}`
          const content = (
            <>
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${TONE_ICON[kpi.tone]}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <p className="text-[11px] font-medium text-zinc-500">{kpi.label}</p>
              </div>
              <p className="mt-2 text-xl font-bold text-zinc-900">{kpi.value}</p>
              <p className="text-[11px] text-zinc-400">{kpi.sub}</p>
            </>
          )
          if (kpi.href) {
            return (
              <Link key={kpi.label} href={kpi.href} className={cardClass}>
                {content}
              </Link>
            )
          }
          return (
            <button
              key={kpi.label}
              type="button"
              onClick={kpi.onClick}
              className={`${cardClass} w-full`}
            >
              {content}
            </button>
          )
        })}
      </div>
    </div>
  )
}
