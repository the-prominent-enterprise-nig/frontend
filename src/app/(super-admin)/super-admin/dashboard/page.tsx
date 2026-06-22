export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { AlertTriangle, Building2, CheckCircle2, Plus, Users } from 'lucide-react'
import { api } from '@/src/libs/api/client'

interface DashboardStats {
  totalEnterprises: number
  activeEnterprises: number
  trialEnterprises: number
  suspendedEnterprises: number
  totalUsers: number
  recentEnterprises: Array<{
    id: string
    companyLegalName: string
    companyTradingName?: string
    status: string
    createdAt: string
    activeSubscription?: { planCode: string; status: string }
  }>
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  trial: 'bg-sky-100 text-sky-700',
  suspended: 'bg-red-100 text-red-700',
  closed: 'bg-zinc-100 text-zinc-500',
}

function statusBadge(status: string) {
  return STATUS_BADGE[status.toLowerCase()] ?? STATUS_BADGE.pending
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function SuperAdminDashboard() {
  const result = await api.get<DashboardStats>('/super-admin/dashboard')
  const stats = result.data

  const statCards = [
    {
      label: 'Total Businesses',
      value: stats?.totalEnterprises ?? 0,
      icon: Building2,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
    },
    {
      label: 'Active',
      value: stats?.activeEnterprises ?? 0,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      label: 'Suspended',
      value: stats?.suspendedEnterprises ?? 0,
      icon: AlertTriangle,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
    },
    {
      label: 'Total Users',
      value: stats?.totalUsers ?? 0,
      icon: Users,
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Platform Overview</h1>
        <p className="mt-0.5 text-sm text-zinc-500">Monitor and manage all tenant businesses.</p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/super-admin/enterprises/new"
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Add Business
        </Link>
        <Link
          href="/super-admin/enterprises"
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
        >
          <Building2 className="h-4 w-4" />
          View All Businesses
        </Link>
        <Link
          href="/super-admin/audit-logs"
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
        >
          <Users className="h-4 w-4" />
          Audit Logs
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm"
          >
            <div className={`mb-4 inline-flex rounded-full p-2.5 ${card.iconBg}`}>
              <card.icon className={`h-5 w-5 ${card.iconColor}`} />
            </div>
            <p className="text-2xl font-bold text-zinc-900" suppressHydrationWarning>
              {card.value.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs font-medium text-zinc-500">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Recent registrations */}
      <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">Recent Registrations</h2>
          <Link
            href="/super-admin/enterprises"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            View all
          </Link>
        </div>

        {!stats?.recentEnterprises?.length ? (
          <p className="px-6 py-10 text-center text-sm text-zinc-400">
            No businesses registered yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Business Name
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {stats.recentEnterprises.map((enterprise) => (
                  <tr key={enterprise.id} className="group transition-colors hover:bg-zinc-50/70">
                    <td className="px-6 py-3.5">
                      <Link
                        href={`/super-admin/enterprises/${enterprise.id}`}
                        className="font-medium text-zinc-900 transition-colors group-hover:text-indigo-600"
                      >
                        {enterprise.companyTradingName ?? enterprise.companyLegalName}
                      </Link>
                      {enterprise.companyTradingName &&
                        enterprise.companyTradingName !== enterprise.companyLegalName && (
                          <p className="text-xs text-zinc-400">{enterprise.companyLegalName}</p>
                        )}
                    </td>
                    <td className="px-6 py-3.5">
                      {enterprise.activeSubscription?.planCode ? (
                        <span className="font-medium text-zinc-700">
                          {enterprise.activeSubscription.planCode}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${statusBadge(enterprise.status)}`}
                      >
                        {enterprise.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-zinc-500">
                      {formatDate(enterprise.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
