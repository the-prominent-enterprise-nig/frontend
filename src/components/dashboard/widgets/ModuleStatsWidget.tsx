'use client'

import Link from 'next/link'
import { ShoppingCart, Package, Receipt, Users } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { CARD_SHADOW_RESTING, CARD_SHADOW_HOVER } from '../DashboardWidgetWrapper'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { useModuleStats } from './dashboardQueries'

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(n)
}

export default function ModuleStatsWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs' || variant === 'sm'

  const branchId = usePosBranchContext((s) => s.branchId)
  const { data: stats } = useModuleStats(branchId)

  if (!stats) {
    return (
      <div className={`grid gap-3 ${isCompact ? 'grid-cols-2' : 'grid-cols-4'}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[150px] rounded-xl bg-zinc-100 animate-pulse" />
        ))}
      </div>
    )
  }

  const MODULES = [
    {
      id: 'pos',
      label: 'Point of Sale',
      href: '/pos',
      icon: ShoppingCart,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      accent: 'border-blue-100',
      stats: [
        { label: 'Total Sales', value: formatCurrency(Number(stats.pos[0]?.value ?? 0)) },
        { label: 'Transactions', value: stats.pos[1]?.value ?? 0 },
        { label: 'Voids', value: stats.pos[2]?.value ?? 0 },
      ],
      links: [{ label: 'Transactions', href: '/pos/transactions' }],
    },
    {
      id: 'inventory',
      label: 'Inventory',
      href: '/inventory',
      icon: Package,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      accent: 'border-amber-100',
      stats: stats.inventory,
      links: [{ label: 'Purchase Orders', href: '/inventory/purchase-orders' }],
    },
    {
      id: 'accounting',
      label: 'Accounting',
      href: '/accounting',
      icon: Receipt,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      accent: 'border-emerald-100',
      stats: [
        {
          label: 'AR Outstanding',
          value: formatCurrency(Number(stats.accounting[0]?.value ?? 0)),
        },
        { label: 'Overdue', value: stats.accounting[1]?.value ?? 0 },
        { label: 'Pending Approval', value: stats.accounting[2]?.value ?? 0 },
      ],
      links: [
        { label: 'AR Invoices', href: '/accounting/ar-invoices' },
        { label: 'AP Bills', href: '/accounting/ap-bills' },
        { label: 'Reports', href: '/accounting/reports' },
      ],
    },
    {
      id: 'crm',
      label: 'CRM',
      href: '/crm',
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      accent: 'border-purple-100',
      stats: stats.crm,
      links: [
        { label: 'Leads', href: '/crm/leads' },
        { label: 'Customers', href: '/crm/customers' },
      ],
    },
  ]

  return (
    <div className={`grid gap-3 ${isCompact ? 'grid-cols-2' : 'grid-cols-4'}`}>
      {MODULES.map((mod) => {
        const Icon = mod.icon
        return (
          <div
            key={mod.id}
            className={`rounded-xl border ${mod.accent} bg-white p-2.5 transition-all duration-300 ${CARD_SHADOW_RESTING} ${CARD_SHADOW_HOVER} hover:-translate-y-0.5`}
          >
            <Link href={mod.href} className="block space-y-2">
              <div className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${mod.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${mod.color}`} />
                </div>
                <p className="text-xs font-semibold text-zinc-700">{mod.label}</p>
              </div>
              <div className="space-y-1">
                {mod.stats.map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between gap-2">
                    <p className="text-[10px] text-zinc-400">{stat.label}</p>
                    <p className="text-xs font-bold text-zinc-900">{stat.value}</p>
                  </div>
                ))}
              </div>
            </Link>
            {!isCompact && mod.links.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-zinc-100 pt-1.5">
                {mod.links.map((link, i) => (
                  <span key={link.href} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-zinc-300">·</span>}
                    <Link
                      href={link.href}
                      className="text-[10px] font-medium text-zinc-500 transition-colors hover:text-purple-600"
                    >
                      {link.label}
                    </Link>
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
