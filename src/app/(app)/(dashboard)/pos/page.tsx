'use client'

import { useRouter } from 'next/navigation'
import { useTransactions, useSessions, useTerminals } from './_hooks/usePos'
import {
  ShoppingCart,
  Monitor,
  ClipboardList,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  ReceiptText,
} from 'lucide-react'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(n)
}

export default function PosOverviewPage() {
  const router = useRouter()

  const autoRefresh = { refetchInterval: 30_000, refetchOnWindowFocus: true }
  const {
    data: txData,
    isLoading: txLoading,
    refetch,
    isFetching,
  } = useTransactions(undefined, autoRefresh)
  const { data: sessData, isLoading: sessLoading } = useSessions(undefined, autoRefresh)
  const { data: termData, isLoading: termLoading } = useTerminals(autoRefresh)

  type Row = Record<string, unknown>
  const transactions = (() => {
    const d = txData?.data
    return (Array.isArray(d) ? d : ((d as unknown as { data?: Row[] })?.data ?? [])) as Row[]
  })()
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
      href: '/pos/terminals',
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
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
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
                      key={String(tx.id ?? '')}
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                      onClick={() => router.push('/pos/transactions')}
                    >
                      <td className="px-5 py-3 font-mono text-sm font-medium text-gray-800">
                        {String(tx.transactionNumber ?? '')}
                      </td>
                      <td className="px-5 py-3">
                        <span className="capitalize text-gray-600">
                          {String(tx.transactionType ?? '')}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            tx.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {String(tx.status ?? '')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(parseFloat(String(tx.totalAmount ?? 0)))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
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
        <div className="mt-3 h-8 w-24 animate-pulse rounded bg-gray-200" />
      ) : (
        <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      )}
    </div>
  )
}
