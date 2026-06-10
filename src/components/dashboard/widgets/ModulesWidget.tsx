'use client'

import { useEffect, useState } from 'react'
import { Users, Calculator, Package, ExternalLink, Bell } from 'lucide-react'
import Link from 'next/link'
import { useWidgetSize } from '../WidgetSizeContext'
import { QueueCategories, QueueStatsAPI } from '@/src/libs/data/QueueData'
import { ARInvoices } from '@/src/libs/data/AccountingV2Data'
import { api } from '@/src/libs/api/client'

interface ModuleStat {
  label: string
  value: string | number
}

interface Module {
  label: string
  description: string
  icon: typeof Users
  iconBg: string
  iconColor: string
  href: string
  stats: ModuleStat[]
}

function fmtMoneyShort(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `₱${(n / 1_000).toFixed(1)}K`
  return `₱${Math.round(n)}`
}

export default function ModulesWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs' || variant === 'sm'
  const gridCols =
    variant === 'lg' ? 'grid-cols-3' : variant === 'md' ? 'grid-cols-2' : 'grid-cols-1'

  const [hrStats, setHrStats] = useState<ModuleStat[]>([
    { label: 'Employees', value: '—' },
    { label: 'On Leave', value: '—' },
    { label: 'Pending', value: '—' },
  ])
  const [inventoryStats, setInventoryStats] = useState<ModuleStat[]>([
    { label: 'Products', value: '—' },
    { label: 'Low Stock', value: '—' },
    { label: 'Value', value: '—' },
  ])
  const [queueStats, setQueueStats] = useState<ModuleStat[]>([
    { label: 'Queues', value: '—' },
    { label: 'Now Serving', value: '—' },
    { label: 'Waiting', value: '—' },
  ])
  const [accountingStats, setAccountingStats] = useState<ModuleStat[]>([
    { label: 'Invoices', value: '—' },
    { label: 'Outstanding', value: '—' },
    { label: 'Overdue', value: '—' },
  ])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [employees, summary, items, cats, qStats, ar] = await Promise.all([
        api.get<{ meta?: { total?: number } }>('/employees', { limit: 1 }),
        api.get<{
          pending?: number
          approved?: number
          pendingRequests?: number
          approvedRequests?: number
        }>('/leave-management/summary'),
        api.get<{ meta?: { total?: number } }>('/inventory/items', { limit: 1 }),
        QueueCategories.list(),
        QueueStatsAPI.get(),
        ARInvoices.list(),
      ])
      if (cancelled) return

      setHrStats([
        { label: 'Employees', value: employees.data?.meta?.total ?? 0 },
        { label: 'On Leave', value: summary.data?.approved ?? summary.data?.approvedRequests ?? 0 },
        { label: 'Pending', value: summary.data?.pending ?? summary.data?.pendingRequests ?? 0 },
      ])

      setInventoryStats([
        { label: 'Products', value: items.data?.meta?.total ?? 0 },
        { label: 'Low Stock', value: '—' },
        { label: 'Value', value: '—' },
      ])

      setQueueStats([
        { label: 'Queues', value: cats.data?.length ?? 0 },
        { label: 'Now Serving', value: qStats.data?.nowServing ?? 0 },
        { label: 'Waiting', value: qStats.data?.waiting ?? 0 },
      ])

      const invoices = ar.data?.items ?? []
      const outstanding = invoices.reduce(
        (s, i) => s + Math.max(0, (i.totalAmount ?? 0) - (i.amountPaid ?? 0)),
        0
      )
      const now = Date.now()
      const overdue = invoices.filter((i) => {
        const paid = (i.amountPaid ?? 0) >= (i.totalAmount ?? 0) && (i.totalAmount ?? 0) > 0
        if (paid) return false
        if (i.status === 'OVERDUE') return true
        return i.dueDate ? new Date(i.dueDate).getTime() < now : false
      }).length
      setAccountingStats([
        { label: 'Invoices', value: invoices.length },
        { label: 'Outstanding', value: fmtMoneyShort(outstanding) },
        { label: 'Overdue', value: overdue },
      ])
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const modules: Module[] = [
    {
      label: 'Human Resources',
      description: 'Manage employees, attendance, payroll & leave',
      icon: Users,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      href: '/human-resource',
      stats: hrStats,
    },
    {
      label: 'Accounting',
      description: 'Invoices, expenses, and financial reports',
      icon: Calculator,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      href: '/accounting',
      stats: accountingStats,
    },
    {
      label: 'Inventory',
      description: 'Products, stock levels, and adjustments',
      icon: Package,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      href: '/inventory',
      stats: inventoryStats,
    },
    {
      label: 'Queue Management',
      description: 'Service queues, tickets, and counters',
      icon: Bell,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      href: '/queue-management',
      stats: queueStats,
    },
  ]

  return (
    <div className={`grid gap-2 ${gridCols}`}>
      {modules.map((mod) => {
        const Icon = mod.icon
        return (
          <Link
            key={mod.label}
            href={mod.href}
            className="group flex min-w-0 flex-col gap-2 overflow-hidden rounded-xl bg-white p-3 shadow-sm ring-1 ring-zinc-100 transition hover:ring-purple-300 hover:shadow-md"
          >
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={`flex shrink-0 items-center justify-center rounded-lg ${mod.iconBg} ${isCompact ? 'h-8 w-8' : 'h-10 w-10'}`}
              >
                <Icon className={`${isCompact ? 'h-4 w-4' : 'h-5 w-5'} ${mod.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-zinc-900 text-sm">{mod.label}</p>
                {!isCompact && (
                  <p className="truncate text-xs text-zinc-500 mt-0.5">{mod.description}</p>
                )}
              </div>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-300 group-hover:text-purple-400 transition" />
            </div>
            {variant === 'lg' && (
              <div className="flex gap-3 border-t border-zinc-100 pt-2">
                {mod.stats.map((s) => (
                  <div key={s.label} className="flex-1 min-w-0">
                    <p className="text-[10px] text-zinc-500 truncate">{s.label}</p>
                    <p className="text-sm font-semibold text-zinc-800">{s.value}</p>
                  </div>
                ))}
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}
