'use client'

import { useEffect, useState } from 'react'
import { ShoppingCart, Package, Receipt, Users } from 'lucide-react'
import { useWidgetSize } from '../WidgetSizeContext'
import { getTransactions } from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import { getReorderAlerts } from '@/src/app/(app)/(dashboard)/inventory/reorder/_actions/get-reorder-alerts'
import {
  getReorderAlertsByWarehouse,
  type ReorderAlertByWarehouse,
} from '@/src/app/(app)/(dashboard)/inventory/reorder/_actions/get-reorder-alerts-by-warehouse'
import { ARInvoices, APBills } from '@/src/libs/data/AccountingV2Data'
import { leadsApi, customersApi } from '@/src/libs/api/crm'
import { api } from '@/src/libs/api/client'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { resolveBranchWarehouseIds } from '../resolveBranchWarehouses'

interface ModuleStat {
  label: string
  value: string | number
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(n)
}

function todayRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() }
}

const PENDING_VOUCHER_STATUSES = new Set(['pending_online_approval', 'pending_onsite_approval'])

/**
 * "All Branches" uses the tenant-wide reorder-alerts endpoint as-is. A
 * specific branch has no direct reorder-alerts filter, so it's resolved to
 * that branch's warehouse(s) first, then queried per-warehouse via the
 * other, warehouse-filterable endpoint and combined.
 */
async function loadInventoryAlerts(
  branchId: string | null
): Promise<{ lowStockCount: number; outOfStockCount: number }> {
  if (!branchId) {
    const res = await getReorderAlerts({ limit: 200 })
    const data = res.data as { total?: number; data?: { currentQty?: number }[] } | undefined
    const alertList = data?.data ?? []
    return {
      lowStockCount: data?.total ?? alertList.length,
      outOfStockCount: alertList.filter((a) => (a.currentQty ?? 0) === 0).length,
    }
  }

  const warehouseIds = await resolveBranchWarehouseIds(branchId)
  if (warehouseIds.length === 0) return { lowStockCount: 0, outOfStockCount: 0 }

  const results = await Promise.all(warehouseIds.map((id) => getReorderAlertsByWarehouse(id)))
  const alerts: ReorderAlertByWarehouse[] = results.flatMap((r) => r.data ?? [])
  return {
    lowStockCount: alerts.length,
    outOfStockCount: alerts.filter((a) => a.currentQty === 0).length,
  }
}

export default function ModuleStatsWidget() {
  const { variant } = useWidgetSize()
  const isCompact = variant === 'xs' || variant === 'sm'

  const [posStats, setPosStats] = useState<ModuleStat[]>([
    { label: "Today's Sales", value: '—' },
    { label: 'Transactions', value: '—' },
    { label: 'Voids', value: '—' },
  ])
  const [inventoryStats, setInventoryStats] = useState<ModuleStat[]>([
    { label: 'Active SKUs', value: '—' },
    { label: 'Low Stock', value: '—' },
    { label: 'Out of Stock', value: '—' },
  ])
  const [accountingStats, setAccountingStats] = useState<ModuleStat[]>([
    { label: 'AR Outstanding', value: '—' },
    { label: 'Overdue', value: '—' },
    { label: 'Pending Approval', value: '—' },
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
      const { dateFrom, dateTo } = todayRange()
      const [txRes, inventoryAlerts, itemsRes, arRes, apRes, customersRes, leadsRes] =
        await Promise.all([
          getTransactions({ dateFrom, dateTo, branchId: branchId ?? undefined }),
          loadInventoryAlerts(branchId),
          api.get<{ meta?: { total?: number } }>('/inventory/items', { limit: 1 }),
          ARInvoices.list(),
          APBills.list(),
          customersApi.list({ limit: 200 }),
          leadsApi.list({ limit: 200 }),
        ])
      if (cancelled) return

      // POS
      const todayTxns = txRes.data ?? []
      const saleTxns = todayTxns.filter(
        (t) => t.transactionType === 'sale' && t.status !== 'voided'
      )
      const totalSales = saleTxns.reduce((sum, t) => sum + Number(t.totalAmount ?? 0), 0)
      const txCount = todayTxns.filter((t) => t.status !== 'voided').length
      const voidCount = todayTxns.filter((t) => t.status === 'voided').length
      setPosStats([
        { label: "Today's Sales", value: formatCurrency(totalSales) },
        { label: 'Transactions', value: txCount },
        { label: 'Voids', value: voidCount },
      ])

      // Inventory
      const activeSkus = itemsRes.data?.meta?.total ?? 0
      setInventoryStats([
        { label: 'Active SKUs', value: activeSkus },
        { label: 'Low Stock', value: inventoryAlerts.lowStockCount },
        { label: 'Out of Stock', value: inventoryAlerts.outOfStockCount },
      ])

      // Accounting
      const invoices = arRes.data?.items ?? []
      const outstanding = invoices.reduce(
        (s, i) => s + Math.max(0, (i.totalAmount ?? 0) - (i.amountPaid ?? 0)),
        0
      )
      const now = Date.now()
      const overdueCount = invoices.filter((i) => {
        const paid = (i.amountPaid ?? 0) >= (i.totalAmount ?? 0) && (i.totalAmount ?? 0) > 0
        if (paid) return false
        if (i.status === 'OVERDUE') return true
        return i.dueDate ? new Date(i.dueDate).getTime() < now : false
      }).length
      const apBills = apRes.data?.items ?? []
      const pendingApprovalCount = apBills.filter(
        (b) => b.voucherApprovalStatus && PENDING_VOUCHER_STATUSES.has(b.voucherApprovalStatus)
      ).length
      setAccountingStats([
        { label: 'AR Outstanding', value: formatCurrency(outstanding) },
        { label: 'Overdue', value: overdueCount },
        { label: 'Pending Approval', value: pendingApprovalCount },
      ])

      // CRM
      const totalCustomers = customersRes.data?.meta?.total ?? 0
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
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

  const MODULES = [
    {
      id: 'pos',
      label: 'Point of Sale',
      icon: ShoppingCart,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      accent: 'border-blue-100',
      stats: posStats,
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: Package,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      accent: 'border-amber-100',
      stats: inventoryStats,
    },
    {
      id: 'accounting',
      label: 'Accounting',
      icon: Receipt,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      accent: 'border-emerald-100',
      stats: accountingStats,
    },
    {
      id: 'crm',
      label: 'CRM',
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      accent: 'border-purple-100',
      stats: crmStats,
    },
  ]

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
