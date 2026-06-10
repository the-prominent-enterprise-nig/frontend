import { api } from '@/src/libs/api/client'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ChevronRight,
  Building2,
  GitBranch,
  Briefcase,
  CreditCard,
  Package,
  ClipboardList,
  Edit,
  Globe,
  Phone,
  User,
  Clock,
  Check,
  X,
} from 'lucide-react'
import { EnterpriseStatusActions } from './_components/EnterpriseStatusActions'
import { InviteCard } from './_components/InviteCard'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EnterpriseDetail {
  id: string
  companyLegalName: string
  companyTradingName?: string | null
  industry: string
  country: string
  contactPerson?: string | null
  mobileNumber?: string | null
  timezone?: string | null
  status: string
  createdAt: string
  activeSubscription?: {
    planCode: string
    status: string
    billingCycle: string
    userLimit: number
    branchLimit: number
    trialEndsAt?: string | null
    expirationDate?: string | null
  } | null
  businessSettings?: {
    enabledModules: string[]
    defaultCurrency: string
  } | null
  _count?: { users: number; branches: number; employees: number }
}

// ─── Module registry (for display) ─────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  hr: 'HR & Payroll',
  attendance: 'Attendance & Time',
  leave: 'Leave Management',
  payroll: 'Payroll',
  accounting: 'Accounting',
  procurement: 'Procurement',
  inventory: 'Inventory',
  pos: 'Point of Sale',
  crm: 'CRM',
  sales: 'Sales & Orders',
  'queue-management': 'Queue Management',
  'project-management': 'Project Management',
}

const ALL_MODULE_CODES = Object.keys(MODULE_LABELS)

// ─── Badge styles ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  trial: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  closed: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
}

const SUB_STATUS_BADGE: Record<string, string> = {
  trial: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  expired: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  cancelled: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  past_due: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
}

// ─── Shared sub-components ──────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {children}
    </div>
  )
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</h2>
      {action && <div>{action}</div>}
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ElementType
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />}
      <span className="w-36 shrink-0 text-sm text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-800 dark:text-zinc-200">
        {value ?? <span className="text-zinc-300 dark:text-zinc-600">—</span>}
      </span>
    </div>
  )
}

function StatBlock({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType
  value: number
  label: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 py-4">
      <Icon className="h-5 w-5 text-zinc-400" />
      <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  )
}

function fmt(dateStr: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  })
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function EnterpriseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [result, inviteResult] = await Promise.all([
    api.get<EnterpriseDetail>(`/super-admin/enterprises/${id}`),
    api.get<{
      id: string
      link: string
      expiresAt: string
      usedAt: string | null
      createdAt: string
      status: 'pending' | 'expired' | 'used'
    } | null>(`/super-admin/enterprises/${id}/invite`),
  ])

  if (!result.success || !result.data) return notFound()
  const e = result.data
  const invite = inviteResult.data ?? null

  const enabledModules: string[] = Array.isArray(e.businessSettings?.enabledModules)
    ? (e.businessSettings!.enabledModules as string[])
    : []

  const sub = e.activeSubscription
  const counts = e._count ?? { users: 0, branches: 0, employees: 0 }

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <nav className="mb-5 flex items-center gap-1.5 text-sm text-zinc-400">
        <Link
          href="/super-admin/enterprises"
          className="hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          Businesses
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-zinc-700 dark:text-zinc-300">{e.companyLegalName}</span>
      </nav>

      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950">
            <Building2 className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {e.companyTradingName ?? e.companyLegalName}
              </h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[e.status] ?? 'bg-zinc-100 text-zinc-500'}`}
              >
                {e.status}
              </span>
            </div>
            {e.companyTradingName && (
              <p className="mt-0.5 text-sm text-zinc-500">{e.companyLegalName}</p>
            )}
          </div>
        </div>

        <Link
          href={`/super-admin/enterprises/${id}/edit`}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Edit className="h-4 w-4" />
          Edit
        </Link>
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left column (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Business profile card */}
          <Card>
            <CardHeader
              title="Business Profile"
              action={
                <Link
                  href={`/super-admin/enterprises/${id}/edit`}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                >
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </Link>
              }
            />
            <div className="divide-y divide-zinc-50 px-5 dark:divide-zinc-800">
              <InfoRow label="Legal Name" value={e.companyLegalName} />
              {e.companyTradingName && (
                <InfoRow label="Trading Name" value={e.companyTradingName} />
              )}
              <InfoRow
                icon={Briefcase}
                label="Industry"
                value={
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {e.industry}
                  </span>
                }
              />
              <InfoRow
                icon={Globe}
                label="Country"
                value={<span className="font-mono text-sm">{e.country}</span>}
              />
              {e.timezone && <InfoRow icon={Clock} label="Timezone" value={e.timezone} />}
              {e.contactPerson && (
                <InfoRow icon={User} label="Contact Person" value={e.contactPerson} />
              )}
              {e.mobileNumber && <InfoRow icon={Phone} label="Mobile" value={e.mobileNumber} />}
              <InfoRow label="Joined" value={fmt(e.createdAt)} />
            </div>
          </Card>

          {/* Enabled modules card */}
          <Card>
            <CardHeader
              title="Enabled Modules"
              action={
                <Link
                  href={`/super-admin/enterprises/${id}/modules`}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                >
                  <Package className="h-3.5 w-3.5" />
                  Manage Modules
                </Link>
              }
            />
            <div className="grid grid-cols-1 gap-0 p-5 sm:grid-cols-2">
              {ALL_MODULE_CODES.map((code) => {
                const active = enabledModules.includes(code)
                return (
                  <div
                    key={code}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${
                      active
                        ? 'text-zinc-800 dark:text-zinc-200'
                        : 'text-zinc-400 dark:text-zinc-600'
                    }`}
                  >
                    {active ? (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                        <Check
                          className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
                          strokeWidth={3}
                        />
                      </div>
                    ) : (
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <X className="h-3 w-3 text-zinc-400" strokeWidth={3} />
                      </div>
                    )}
                    <span className="text-sm">{MODULE_LABELS[code]}</span>
                  </div>
                )
              })}
            </div>
            {enabledModules.length === 0 && (
              <p className="px-5 pb-5 text-sm text-zinc-400">No modules assigned yet.</p>
            )}
          </Card>
        </div>

        {/* ── Right sidebar (1/3) */}
        <div className="space-y-4">
          {/* Quick stats */}
          <Card>
            <CardHeader title="Quick Stats" />
            <div className="flex divide-x divide-zinc-100 dark:divide-zinc-800">
              <StatBlock icon={Briefcase} value={counts.employees} label="Employees" />
              <StatBlock icon={GitBranch} value={counts.branches} label="Branches" />
            </div>
          </Card>

          {/* Subscription */}
          <Card>
            <CardHeader
              title="Subscription"
              action={
                <Link
                  href={`/super-admin/enterprises/${id}/subscription`}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Manage
                </Link>
              }
            />
            {sub ? (
              <div className="divide-y divide-zinc-50 px-5 dark:divide-zinc-800">
                <div className="flex items-center gap-3 py-2.5">
                  <span className="w-28 shrink-0 text-sm text-zinc-500">Plan</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${SUB_STATUS_BADGE[sub.status] ?? 'bg-zinc-100 text-zinc-500'}`}
                  >
                    {sub.planCode}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-2.5">
                  <span className="w-28 shrink-0 text-sm text-zinc-500">Status</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${SUB_STATUS_BADGE[sub.status] ?? 'bg-zinc-100 text-zinc-500'}`}
                  >
                    {sub.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-2.5">
                  <span className="w-28 shrink-0 text-sm text-zinc-500">Billing</span>
                  <span className="text-sm capitalize text-zinc-800 dark:text-zinc-200">
                    {sub.billingCycle}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-2.5">
                  <span className="w-28 shrink-0 text-sm text-zinc-500">User Limit</span>
                  <span className="tabular-nums text-sm text-zinc-800 dark:text-zinc-200">
                    {sub.userLimit}
                  </span>
                </div>
                <div className="flex items-center gap-3 py-2.5">
                  <span className="w-28 shrink-0 text-sm text-zinc-500">Branch Limit</span>
                  <span className="tabular-nums text-sm text-zinc-800 dark:text-zinc-200">
                    {sub.branchLimit}
                  </span>
                </div>
                {sub.trialEndsAt && (
                  <div className="flex items-center gap-3 py-2.5">
                    <span className="w-28 shrink-0 text-sm text-zinc-500">Trial Ends</span>
                    <span className="text-sm text-zinc-800 dark:text-zinc-200">
                      {fmt(sub.trialEndsAt, { month: 'short' })}
                    </span>
                  </div>
                )}
                {sub.expirationDate && (
                  <div className="flex items-center gap-3 py-2.5">
                    <span className="w-28 shrink-0 text-sm text-zinc-500">Expires</span>
                    <span className="text-sm text-zinc-800 dark:text-zinc-200">
                      {fmt(sub.expirationDate, { month: 'short' })}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="px-5 py-5 text-sm text-zinc-400">No active subscription.</p>
            )}
          </Card>

          {/* Status actions */}
          <Card>
            <CardHeader title="Actions" />
            <div className="p-4">
              <EnterpriseStatusActions
                enterpriseId={id}
                currentStatus={e.status}
                enterpriseName={e.companyTradingName ?? e.companyLegalName}
              />
            </div>
          </Card>

          {/* Invite */}
          {e.status !== 'active' && <InviteCard enterpriseId={id} invite={invite} />}

          {/* Audit log shortcut */}
          <Link
            href={`/super-admin/audit-logs?enterpriseId=${id}`}
            className="flex items-center gap-2.5 rounded-2xl border border-zinc-200 bg-white px-5 py-3.5 text-sm text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60"
          >
            <ClipboardList className="h-4 w-4 shrink-0 text-zinc-400" />
            View Audit Log for this Business
          </Link>
        </div>
      </div>
    </div>
  )
}
