export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {
  ShoppingCart,
  PackageCheck,
  Users,
  ClipboardList,
  Receipt,
  RefreshCcw,
  BarChart3,
  ArrowRight,
} from 'lucide-react'
import { getSalesSummary, type SalesSummary } from '@/src/libs/actions/sales.actions'

function formatPeso(amount: string) {
  const value = Number(amount)
  if (!Number.isFinite(value) || value === 0) return '₱0.00'

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export default async function SalesPage() {
  const summaryResult = await getSalesSummary()
  const emptySummary: SalesSummary = {
    totalRevenue: '0',
    pendingOrders: 0,
    ordersToDeliver: 0,
    overdueInvoices: 0,
    activeCustomers: 0,
    totalQuotations: 0,
    convertedQuotations: 0,
    totalOrders: 0,
    openOrders: 0,
  }
  const summary: SalesSummary =
    summaryResult.success && summaryResult.data ? summaryResult.data : emptySummary

  const stats = [
    {
      label: 'Total Revenue',
      value: formatPeso(summary.totalRevenue),
      sub: 'Confirmed, processing, delivered orders',
    },
    { label: 'Pending Orders', value: String(summary.pendingOrders), sub: 'Draft orders' },
    {
      label: 'Orders to Deliver',
      value: String(summary.ordersToDeliver),
      sub: 'Confirmed or processing orders',
    },
    {
      label: 'Overdue Invoices',
      value: String(summary.overdueInvoices),
      sub: 'Coming soon: invoice backend',
    },
    {
      label: 'Active Customers',
      value: String(summary.activeCustomers),
      sub: 'Distinct quote/order customers',
    },
    {
      label: 'Quotations',
      value: String(summary.totalQuotations),
      sub: `${summary.convertedQuotations} converted`,
    },
    {
      label: 'Open Orders',
      value: String(summary.openOrders),
      sub: 'Draft, confirmed, processing',
    },
  ]

  const modules = [
    {
      label: 'Quotations',
      description: 'Create and manage price quotations',
      href: '/sales/quotations',
      icon: ClipboardList,
      color: 'bg-amber-100 text-amber-600',
      stats: `${summary.totalQuotations} total`,
    },
    {
      label: 'Sales Orders',
      description: 'Track and process sales orders',
      href: '/sales/orders',
      icon: ShoppingCart,
      color: 'bg-purple-100 text-purple-600',
      stats: `${summary.totalOrders} total`,
    },
    {
      label: 'Customers',
      description: 'Customer account history across Sales and CRM',
      href: null,
      icon: Users,
      color: 'bg-blue-100 text-blue-600',
      stats: 'Coming soon',
    },
    {
      label: 'Deliveries',
      description: 'Picking, packing, partial delivery, and stock deduction',
      href: null,
      icon: PackageCheck,
      color: 'bg-emerald-100 text-emerald-600',
      stats: 'Coming soon',
    },
    {
      label: 'Invoices',
      description: 'Invoice generation, receivables, and payments',
      href: null,
      icon: Receipt,
      color: 'bg-rose-100 text-rose-600',
      stats: 'Coming soon',
    },
    {
      label: 'Returns',
      description: 'Returns, restocking, refunds, and credit notes',
      href: null,
      icon: RefreshCcw,
      color: 'bg-orange-100 text-orange-600',
      stats: 'Coming soon',
    },
    {
      label: 'Reports',
      description: 'Pipeline, conversion, revenue, and rep performance',
      href: null,
      icon: BarChart3,
      color: 'bg-indigo-100 text-indigo-600',
      stats: 'Coming soon',
    },
  ]

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales &amp; Orders</h1>
            <p className="mt-0.5 text-sm text-gray-500">Manage your B2B sales flow end-to-end</p>
          </div>
          <Link
            href="/sales/orders"
            className="flex items-center gap-2 rounded-lg bg-prominent-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-prominent-purple-700 transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            New Order
          </Link>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-gray-500">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="mt-1 text-xs font-medium text-gray-400">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Module Cards */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Modules
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {modules.map((mod) => {
              const Icon = mod.icon
              const cardContent = (
                <>
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${mod.color}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {mod.href ? (
                      <ArrowRight className="h-4 w-4 text-gray-300 transition group-hover:text-purple-500" />
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Soon
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{mod.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{mod.description}</p>
                  </div>
                  <p className="text-xs font-medium text-gray-400">{mod.stats}</p>
                </>
              )

              return mod.href ? (
                <Link
                  key={mod.label}
                  href={mod.href}
                  className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-purple-300 hover:shadow-md"
                >
                  {cardContent}
                </Link>
              ) : (
                <div
                  key={mod.label}
                  className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white/60 p-5 opacity-60"
                >
                  {cardContent}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
