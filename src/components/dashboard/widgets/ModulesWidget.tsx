'use client'

import { useEffect, useState } from 'react'
import { Users, Calculator, Package, ShoppingCart, UsersRound, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useWidgetSize } from '../WidgetSizeContext'
import { ARInvoices } from '@/src/libs/data/AccountingV2Data'
import { api } from '@/src/libs/api/client'
import { getReorderAlerts } from '@/src/app/(app)/(dashboard)/inventory/reorder/_actions/get-reorder-alerts'
import { getReorderAlertsByWarehouse } from '@/src/app/(app)/(dashboard)/inventory/reorder/_actions/get-reorder-alerts-by-warehouse'
import { getValuationReport } from '@/src/app/(app)/(dashboard)/inventory/reports/_actions/get-valuation-report'
import { getTransactions } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import { leadsApi, customersApi } from '@/src/libs/api/crm'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { resolveBranchWarehouseIds } from '../resolveBranchWarehouses'

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

/**
 * "All Branches" uses the tenant-wide reorder-alerts/valuation endpoints as
 * they were already called. A specific branch has no direct filter on
 * either, so it's resolved to that branch's warehouse(s) first, then each
 * is queried individually (via the other, warehouse-filterable reorder
 * endpoint) and combined.
 */
async function loadInventoryStats(
  branchId: string | null
): Promise<{ lowStockCount: number; totalValue: number }> {
  if (!branchId) {
    const [reorderAlerts, valuation] = await Promise.all([
      getReorderAlerts({ limit: 1 }),
      getValuationReport(),
    ])
    const reorderData = reorderAlerts.data as { total?: number } | undefined
    const valuationData = valuation.data as
      | { summary?: { totalValue?: number }; grandTotal?: number }
      | undefined
    return {
      lowStockCount: reorderData?.total ?? 0,
      totalValue: valuationData?.summary?.totalValue ?? valuationData?.grandTotal ?? 0,
    }
  }

  const warehouseIds = await resolveBranchWarehouseIds(branchId)
  if (warehouseIds.length === 0) return { lowStockCount: 0, totalValue: 0 }

  const perWarehouse = await Promise.all(
    warehouseIds.map((id) =>
      Promise.all([getReorderAlertsByWarehouse(id), getValuationReport({ warehouseId: id })])
    )
  )
  let lowStockCount = 0
  let totalValue = 0
  for (const [alertsRes, valuationRes] of perWarehouse) {
    lowStockCount += alertsRes.data?.length ?? 0
    const valuationData = valuationRes.data as
      | { summary?: { totalValue?: number }; grandTotal?: number }
      | undefined
    totalValue += valuationData?.summary?.totalValue ?? valuationData?.grandTotal ?? 0
  }
  return { lowStockCount, totalValue }
}

export default function ModulesWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs' || variant === 'sm'
  const gridCols = variant === 'xs' ? 'grid-cols-1' : 'grid-cols-2'

  // Human Resources card is commented out below — there is no HR module on
  // the backend (no employees/leave-management controllers at all), so
  // /employees and /leave-management/summary 404 for every request. Restore
  // this state + the fetch calls in the effect + the "Human Resources"
  // entry in `modules` below once a real HR backend module exists.
  // const [hrStats, setHrStats] = useState<ModuleStat[]>([
  //   { label: 'Employees', value: '—' },
  //   { label: 'On Leave', value: '—' },
  //   { label: 'Pending', value: '—' },
  // ])
  const [inventoryStats, setInventoryStats] = useState<ModuleStat[]>([
    { label: 'Products', value: '—' },
    { label: 'Low Stock', value: '—' },
    { label: 'Value', value: '—' },
  ])
  const [accountingStats, setAccountingStats] = useState<ModuleStat[]>([
    { label: 'Invoices', value: '—' },
    { label: 'Outstanding', value: '—' },
    { label: 'Overdue', value: '—' },
  ])
  const [posStats, setPosStats] = useState<ModuleStat[]>([
    { label: 'Sales (MTD)', value: '—' },
    { label: 'Transactions', value: '—' },
    { label: 'Refunds', value: '—' },
  ])
  const [crmStats, setCrmStats] = useState<ModuleStat[]>([
    { label: 'Customers', value: '—' },
    { label: 'New This Month', value: '—' },
    { label: 'Active Leads', value: '—' },
  ])

  const branchId = usePosBranchContext((s) => s.branchId)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      const [items, ar, inventoryStatsResult, txRes, customersRes, leadsRes] = await Promise.all([
        // HR: see the commented-out hrStats state above — /employees and
        // /leave-management/summary both 404, no HR backend module exists.
        // api.get<{ meta?: { total?: number } }>('/employees', { limit: 1 }),
        // api.get<{
        //   pending?: number
        //   approved?: number
        //   pendingRequests?: number
        //   approvedRequests?: number
        // }>('/leave-management/summary'),
        api.get<{ meta?: { total?: number } }>('/inventory/items', { limit: 1 }),
        ARInvoices.list(),
        loadInventoryStats(branchId),
        getTransactions({ dateFrom: monthStart.toISOString(), branchId: branchId ?? undefined }),
        customersApi.list({ limit: 200 }),
        leadsApi.list({ limit: 200 }),
      ])
      if (cancelled) return

      setInventoryStats([
        { label: 'Products', value: items.data?.meta?.total ?? 0 },
        { label: 'Low Stock', value: inventoryStatsResult.lowStockCount },
        { label: 'Value', value: fmtMoneyShort(inventoryStatsResult.totalValue) },
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

      const txns = txRes.data ?? []
      const sales = txns.filter((t) => t.transactionType === 'sale' && t.status !== 'voided')
      const refunds = txns.filter((t) => t.transactionType === 'refund' && t.status !== 'voided')
      const totalSales = sales.reduce((sum, t) => sum + Number(t.totalAmount ?? 0), 0)
      setPosStats([
        { label: 'Sales (MTD)', value: fmtMoneyShort(totalSales) },
        { label: 'Transactions', value: sales.length },
        { label: 'Refunds', value: refunds.length },
      ])

      const totalCustomers = customersRes.data?.meta?.total ?? 0
      const newThisMonth = (customersRes.data?.data ?? []).filter(
        (c) => new Date(c.createdAt).getTime() >= monthStart.getTime()
      ).length
      const activeLeads = (leadsRes.data?.data ?? []).filter((l) => l.status === 'active').length
      setCrmStats([
        { label: 'Customers', value: totalCustomers },
        { label: 'New This Month', value: newThisMonth },
        { label: 'Active Leads', value: activeLeads },
      ])
    })()
    return () => {
      cancelled = true
    }
  }, [branchId])

  const modules: Module[] = [
    // Human Resources — see the commented-out hrStats state above.
    // {
    //   label: 'Human Resources',
    //   description: 'Manage employees, attendance, payroll & leave',
    //   icon: Users,
    //   iconBg: 'bg-purple-100',
    //   iconColor: 'text-purple-600',
    //   href: '/human-resource',
    //   stats: hrStats,
    // },
    {
      label: 'Point of Sale',
      description: 'Sales, transactions, and checkout',
      icon: ShoppingCart,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      href: '/pos',
      stats: posStats,
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
      label: 'Accounting',
      description: 'Invoices, expenses, and financial reports',
      icon: Calculator,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      href: '/accounting',
      stats: accountingStats,
    },
    {
      label: 'CRM',
      description: 'Leads, customers, and pipeline',
      icon: UsersRound,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      href: '/crm',
      stats: crmStats,
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
