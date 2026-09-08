'use client'

import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  getSalesByBranch,
  getTransactions,
} from '@/src/app/(app)/(dashboard)/pos/_actions/pos-actions'
import { getReorderAlerts } from '@/src/app/(app)/(dashboard)/inventory/reorder/_actions/get-reorder-alerts'
import { getReorderAlertsByWarehouse } from '@/src/app/(app)/(dashboard)/inventory/reorder/_actions/get-reorder-alerts-by-warehouse'
import { getRecentActivity } from '@/src/app/(app)/(dashboard)/_actions/activity-actions'
import { ARInvoices, APBills } from '@/src/libs/data/AccountingV2Data'
import { customersApi, leadsApi } from '@/src/libs/api/crm'
import { getEnterpriseSummary } from '@/src/libs/actions/enterprise.actions'
import { api } from '@/src/libs/api/client'
import { resolveBranchWarehouseIds } from '../resolveBranchWarehouses'
import { getNeedsAttentionItems } from './needsAttentionData'
import { arInvoicesKey, salesByBranchKey, needsAttentionKey } from './dashboardQueryKeys'

export type EmployeeBirthday = {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string // YYYY-MM-DD
}

/** Shared between the Calendar widget (birthday markers) and the Employee
 * Birthdays widget — both want the exact same unfiltered list, so a
 * dashboard with both visible (e.g. after customizing via Edit Dashboard)
 * fires this once instead of twice. */
export function useEmployeeBirthdays() {
  return useQuery({
    queryKey: ['dashboard', 'employee-birthdays'] as const,
    queryFn: async () => (await api.get<EmployeeBirthday[]>('/users/birthdays')).data ?? [],
  })
}

/**
 * Shared between any widget that needs this branch's AR invoices (currently
 * the KPI strip's "Outstanding AR" tile) — see `needsAttentionData.ts` for
 * the other side of the dedup, which fetches the same key internally.
 *
 * `isOverdue` is computed here (at fetch time) rather than in the widget's
 * render — comparing against `Date.now()` directly during render is an
 * impure read the React Compiler/eslint-plugin-react-hooks purity rule
 * flags, since it'd make the component's output depend on something other
 * than its props/state snapshot.
 */
export function useDashboardArInvoices(branchId?: string) {
  return useQuery({
    queryKey: arInvoicesKey(branchId),
    queryFn: async () => {
      const invoices = (await ARInvoices.list({ branchId })).data?.items ?? []
      const now = Date.now()
      return invoices.map((inv) => {
        const paid = (inv.amountPaid ?? 0) >= (inv.totalAmount ?? 0) && (inv.totalAmount ?? 0) > 0
        const isOverdue =
          !paid &&
          (inv.status === 'OVERDUE' ||
            (inv.dueDate ? new Date(inv.dueDate).getTime() < now : false))
        return { ...inv, isOverdue }
      })
    },
  })
}

/** Shared between the KPI strip's Total Revenue tile and Sales by Branch
 * (when its period toggle is on "All", the default) — same key, one fetch.
 * `placeholderData: keepPreviousData` keeps the previous period's bars on
 * screen while a newly-selected period loads, instead of flashing the
 * loading skeleton over them. */
export function useDashboardSalesByBranch(dateFrom?: string) {
  return useQuery({
    queryKey: salesByBranchKey(dateFrom),
    queryFn: async () => (await getSalesByBranch({ dateFrom })).data ?? [],
    placeholderData: keepPreviousData,
  })
}

export function useDashboardCustomersTotal(limit: number) {
  return useQuery({
    queryKey: ['dashboard', 'customers', limit] as const,
    queryFn: async () => (await customersApi.list({ limit })).data?.meta?.total ?? 0,
  })
}

export function useDashboardEnterpriseSummary() {
  return useQuery({
    queryKey: ['dashboard', 'enterprise-summary'] as const,
    queryFn: async () => (await getEnterpriseSummary()).data,
  })
}

/**
 * Shared between the KPI strip (just the count) and the Needs Attention
 * widget (the full list) — identical query key means React Query fires the
 * underlying 6-endpoint bundle once and both widgets subscribe to the same
 * result, instead of each independently computing it.
 */
export function useNeedsAttentionItems(branchId?: string) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: needsAttentionKey(branchId),
    queryFn: () => getNeedsAttentionItems(branchId, queryClient),
  })
}

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
  const alerts = results.flatMap((r) => r.data ?? [])
  return {
    lowStockCount: alerts.length,
    outOfStockCount: alerts.filter((a) => a.currentQty === 0).length,
  }
}

/**
 * The Module Stats widget's four-card summary (POS/Inventory/Accounting/CRM)
 * — no exact duplicate elsewhere today, but wrapping it in React Query still
 * means leaving the dashboard and coming back within a minute serves the
 * cached result instantly instead of re-running all seven underlying
 * requests. Kept as one query (not four) since the four cards already load
 * together as a unit in the UI.
 */
export function useModuleStats(branchId: string | null) {
  return useQuery({
    queryKey: ['dashboard', 'module-stats', branchId ?? 'all'] as const,
    queryFn: async () => {
      const [txRes, inventoryAlerts, itemsRes, arRes, apRes, customersRes, leadsRes] =
        await Promise.all([
          getTransactions({ branchId: branchId ?? undefined }),
          loadInventoryAlerts(branchId),
          api.get<{ meta?: { total?: number } }>('/inventory/items', { limit: 1 }),
          ARInvoices.list(),
          APBills.list(),
          customersApi.list({ limit: 200 }),
          leadsApi.list({ limit: 200 }),
        ])

      const allTxns = txRes.data ?? []
      const saleTxns = allTxns.filter((t) => t.transactionType === 'sale' && t.status !== 'voided')
      const totalSales = saleTxns.reduce((sum, t) => sum + Number(t.totalAmount ?? 0), 0)
      const txCount = allTxns.filter((t) => t.status !== 'voided').length
      const voidCount = allTxns.filter((t) => t.status === 'voided').length

      const activeSkus = itemsRes.data?.meta?.total ?? 0

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
        (b) =>
          b.voucherApprovalStatus &&
          ['pending_online_approval', 'pending_onsite_approval'].includes(b.voucherApprovalStatus)
      ).length

      const totalCustomers = customersRes.data?.meta?.total ?? 0
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      const newThisMonth = (customersRes.data?.data ?? []).filter(
        (c) => new Date(c.createdAt).getTime() >= monthStart.getTime()
      ).length
      const activeLeads = (leadsRes.data?.data ?? []).filter((l) => l.status === 'active').length

      return {
        pos: [
          { label: 'Total Sales', value: totalSales },
          { label: 'Transactions', value: txCount },
          { label: 'Voids', value: voidCount },
        ],
        inventory: [
          { label: 'Active SKUs', value: activeSkus },
          { label: 'Low Stock', value: inventoryAlerts.lowStockCount },
          { label: 'Out of Stock', value: inventoryAlerts.outOfStockCount },
        ],
        accounting: [
          { label: 'AR Outstanding', value: outstanding },
          { label: 'Overdue', value: overdueCount },
          { label: 'Pending Approval', value: pendingApprovalCount },
        ],
        crm: [
          { label: 'Customers', value: totalCustomers },
          { label: 'New This Month', value: newThisMonth },
          { label: 'Active Leads', value: activeLeads },
        ],
      }
    },
  })
}

export function useDashboardRecentActivity(limit: number, branchId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'recent-activity', limit, branchId ?? 'all'] as const,
    queryFn: async () => (await getRecentActivity({ limit, branchId })).data ?? [],
  })
}
