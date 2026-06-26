'use client'

import { ShoppingCart, Package, Receipt, Users } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'

const MODULES = [
  {
    id: 'pos',
    label: 'Point of Sale',
    icon: ShoppingCart,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    accent: 'border-blue-100',
    stats: [
      { label: "Today's Sales", value: '₱0.00' },
      { label: 'Transactions', value: '0' },
      { label: 'Voids', value: '0' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Package,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    accent: 'border-amber-100',
    stats: [
      { label: 'Active SKUs', value: '0' },
      { label: 'Low Stock', value: '0' },
      { label: 'Out of Stock', value: '0' },
    ],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    icon: Receipt,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    accent: 'border-emerald-100',
    stats: [
      { label: 'AR Outstanding', value: '₱0.00' },
      { label: 'Overdue', value: '0' },
      { label: 'Pending Approval', value: '0' },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    icon: Users,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    accent: 'border-purple-100',
    stats: [
      { label: 'Customers', value: '0' },
      { label: 'New This Month', value: '0' },
      { label: 'Active Leads', value: '0' },
    ],
  },
]

export default function ModuleStatsWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs' || variant === 'sm'

  return (
    <div className={`grid gap-3 ${isCompact ? 'grid-cols-2' : 'grid-cols-4'}`}>
      {MODULES.map((mod) => {
        const Icon = mod.icon
        return (
          <div
            key={mod.id}
            className={`rounded-xl border ${mod.accent} bg-white p-3 shadow-sm space-y-2.5`}
          >
            <div className="flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${mod.bg}`}>
                <Icon className={`h-3.5 w-3.5 ${mod.color}`} />
              </div>
              <p className="text-xs font-semibold text-zinc-700">{mod.label}</p>
            </div>
            <div className="space-y-1.5">
              {mod.stats.map((stat) => (
                <div key={stat.label} className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-zinc-400">{stat.label}</p>
                  <p className="text-xs font-bold text-zinc-900">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
