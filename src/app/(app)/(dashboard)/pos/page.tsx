'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useTransactions,
  useSessions,
  useTerminals,
  usePendingVoidRequests,
  usePendingCancellationRequests,
  usePendingRefundRequests,
  usePendingReleaseFormRequests,
} from './_hooks/usePos'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { useMe } from '@/src/hooks/useMe'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { type SessionUser } from '@/src/libs/guards/permission'
import { TransactionDetail } from './_components/TransactionDetail'
import type { PosTransaction } from '@/src/schema/pos'
import {
  ShoppingCart,
  Monitor,
  ClipboardList,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  ReceiptText,
  Ban,
  ClipboardX,
  RotateCcw,
  FileCheck,
  CheckCircle2,
} from 'lucide-react'

// Tailwind's JIT scanner needs literal class names, so grid-cols can't be
// templated from approvalQueues.length directly.
const APPROVAL_GRID_COLS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(n)
}

export default function PosOverviewPage() {
  const router = useRouter()

  // Only needed to open the Recent Transactions detail modal in place —
  // TransactionDetail requires a real SessionUser (Void Requests tab,
  // Refund flow), so fetched the same way pos/checkout/page.tsx does for a
  // 'use client' page.tsx with no server-side session prop available.
  const [session, setSession] = useState<SessionUser | null>(null)
  useEffect(() => {
    getSessionOrNull().then((s) => setSession(s))
  }, [])
  const [selectedTransaction, setSelectedTransaction] = useState<PosTransaction | null>(null)

  const { branchId } = usePosBranchContext()
  const branchFilter = branchId ? { branchId } : undefined

  const { data: me } = useMe()
  const canReadApprovals = !!me && can(me, POS_PERMISSIONS.TRANSACTIONS_READ)
  const canOverrideApprovals = !!me && can(me, POS_PERMISSIONS.TRANSACTIONS_OVERRIDE)

  const autoRefresh = { refetchInterval: 30_000, refetchOnWindowFocus: true }
  const {
    data: txData,
    isLoading: txLoading,
    refetch,
    isFetching,
  } = useTransactions(branchFilter, autoRefresh)
  const { data: sessData, isLoading: sessLoading } = useSessions(branchFilter, autoRefresh)
  const { data: termData, isLoading: termLoading } = useTerminals(branchFilter, autoRefresh)

  // Void/release only require read access to view (matching those pages'
  // own guards); cancellation/refund approvals require override access —
  // gating the fetch itself, not just the render, avoids a 403 round-trip
  // for roles like Cashier that can't see these queues at all.
  const { data: voidData } = usePendingVoidRequests(branchId ?? undefined, canReadApprovals)
  const { data: releaseData } = usePendingReleaseFormRequests(
    branchId ?? undefined,
    canReadApprovals
  )
  const { data: cancellationData } = usePendingCancellationRequests(
    branchId ?? undefined,
    canOverrideApprovals
  )
  const { data: refundData } = usePendingRefundRequests(branchId ?? undefined, canOverrideApprovals)

  const approvalQueues = [
    canReadApprovals && {
      label: 'Void Requests',
      count: voidData?.data?.length ?? 0,
      href: '/pos/void-requests',
      icon: Ban,
    },
    canOverrideApprovals && {
      label: 'Cancellations',
      count: cancellationData?.data?.length ?? 0,
      href: '/pos/cancellation-requests',
      icon: ClipboardX,
    },
    canOverrideApprovals && {
      label: 'Refunds',
      count: refundData?.data?.length ?? 0,
      href: '/pos/return-refund-approvals',
      icon: RotateCcw,
    },
    canReadApprovals && {
      label: 'Release Forms',
      count: releaseData?.data?.length ?? 0,
      href: '/pos/release-approvals',
      icon: FileCheck,
    },
  ].filter((q): q is Exclude<typeof q, false | undefined> => !!q)

  const pendingApprovalsTotal = approvalQueues.reduce((sum, q) => sum + q.count, 0)
  const transactions: PosTransaction[] = txData?.data ?? []

  type Row = Record<string, unknown>
  const sessions = (() => {
    const d = sessData?.data
    return (Array.isArray(d) ? d : ((d as unknown as { data?: Row[] })?.data ?? [])) as Row[]
  })()
  const terminals = (() => {
    const d = termData?.data
    return (Array.isArray(d) ? d : ((d as unknown as { data?: Row[] })?.data ?? [])) as Row[]
  })()

  const saleTxns = transactions.filter((t) => t.transactionType === 'sale' && t.status !== 'voided')
  const totalSales = saleTxns.reduce((sum, t) => sum + parseFloat(String(t.totalAmount ?? 0)), 0)
  const txCount = transactions.filter((t) => t.status !== 'voided').length

  const openSessions = sessions.filter((s) => s.status === 'open').length
  const activeTerminals = terminals.filter((t) => t.status === 'active').length

  const recentTransactions = [...transactions]
    .sort(
      (a, b) =>
        new Date(String(b.createdAt ?? '')).getTime() -
        new Date(String(a.createdAt ?? '')).getTime()
    )
    .slice(0, 5)

  const isLoading = txLoading || sessLoading || termLoading

  const quickLinks = [
    {
      label: 'New Sale',
      description: 'Open the checkout screen',
      href: '/pos/checkout',
      icon: ShoppingCart,
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Transactions',
      description: 'View all sales, refunds, and exchanges',
      href: '/pos/transactions',
      icon: ReceiptText,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Sessions',
      description: 'Manage cashier sessions',
      href: '/pos/sessions',
      icon: Monitor,
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Terminals',
      description: 'Configure POS terminals',
      href: '/pos/settings/terminals',
      icon: ClipboardList,
      color: 'bg-orange-50 text-orange-600',
    },
  ]

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Point of Sale</h1>
            <p className="mt-1 text-sm text-gray-500">Overview of your POS operations</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-600 transition-colors hover:bg-purple-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Hero CTA */}
        <div className="rounded-2xl bg-gradient-to-r from-purple-700 to-purple-900 p-6 text-white shadow-md">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-purple-300">
                Ready to sell?
              </p>
              <h2 className="mt-1 text-xl font-bold">Start a New Sale</h2>
              <p className="mt-1 text-sm text-purple-200">
                Open the checkout to scan items and process payment
              </p>
            </div>
            <button
              onClick={() => router.push('/pos/checkout')}
              className="shrink-0 rounded-xl bg-white px-6 py-3 text-sm font-bold text-purple-800 shadow transition-colors hover:bg-purple-50"
            >
              Open Transaction →
            </button>
          </div>
        </div>

        {/* Needs Attention */}
        {approvalQueues.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Needs Attention
            </h2>
            {pendingApprovalsTotal === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-5 py-4 text-sm text-gray-500">
                <CheckCircle2 size={16} className="text-green-500" />
                Nothing pending approval right now.
              </div>
            ) : (
              <div
                className={`grid grid-cols-2 gap-3 ${
                  APPROVAL_GRID_COLS[approvalQueues.length] ?? 'lg:grid-cols-4'
                }`}
              >
                {approvalQueues.map((q) => (
                  <button
                    key={q.href}
                    onClick={() => router.push(q.href)}
                    disabled={q.count === 0}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md disabled:cursor-default disabled:opacity-50 disabled:hover:shadow-sm"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        q.count > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <q.icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xl font-bold text-gray-900">{q.count}</p>
                      <p className="truncate text-xs text-gray-500">{q.label}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Sales"
            value={isLoading ? null : formatCurrency(totalSales)}
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            bg="bg-green-50"
          />
          <StatCard
            label="Transactions"
            value={txLoading ? null : String(txCount)}
            icon={<ShoppingCart className="h-5 w-5 text-blue-600" />}
            bg="bg-blue-50"
          />
          <StatCard
            label="Open Sessions"
            value={sessLoading ? null : String(openSessions)}
            icon={<Monitor className="h-5 w-5 text-purple-600" />}
            bg="bg-purple-50"
          />
          <StatCard
            label="Active Terminals"
            value={termLoading ? null : String(activeTerminals)}
            icon={<ClipboardList className="h-5 w-5 text-orange-600" />}
            bg="bg-orange-50"
          />
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Quick Access
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => router.push(link.href)}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${link.color}`}
                >
                  <link.icon className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800">{link.label}</p>
                  <p className="truncate text-xs text-gray-500">{link.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Recent Transactions
            </h2>
            <button
              onClick={() => router.push('/pos/transactions')}
              className="text-xs text-purple-600 hover:underline"
            >
              View all
            </button>
          </div>
          <div className="scroll-fade-x overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            {txLoading ? (
              <div className="space-y-3 p-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex animate-pulse gap-4">
                    <div className="h-4 w-1/4 rounded bg-gray-200" />
                    <div className="h-4 w-1/5 rounded bg-gray-200" />
                    <div className="h-4 w-1/6 rounded bg-gray-200" />
                    <div className="h-4 w-1/6 rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400">
                <ShoppingCart size={36} />
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Transaction #
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Type
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentTransactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                      onClick={() => setSelectedTransaction(tx)}
                    >
                      <td className="px-5 py-3 font-mono text-sm font-medium text-gray-800">
                        {tx.transactionNumber}
                      </td>
                      <td className="px-5 py-3">
                        <span className="capitalize text-gray-600">{tx.transactionType}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            tx.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(tx.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {selectedTransaction && session && (
        <TransactionDetail
          transaction={selectedTransaction}
          session={session}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  bg,
}: {
  label: string
  value: string | null
  icon: React.ReactNode
  bg: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>{icon}</span>
      </div>
      {value === null ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      )}
    </div>
  )
}
