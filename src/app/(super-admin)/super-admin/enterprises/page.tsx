import { api } from '@/src/libs/api/client'
import Link from 'next/link'
import { Building2, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface Enterprise {
  id: string
  companyLegalName: string
  companyTradingName?: string | null
  industry: string
  status: 'pending' | 'active' | 'suspended' | 'closed' | string
  createdAt: string
  activeSubscription?: { planCode: string; status: string } | null
  businessSettings?: { enabledModules?: string[] } | null
  _count?: { users: number; branches: number }
}

interface EnterprisesResponse {
  data: Enterprise[]
  meta: { total: number; page: number; totalPages: number }
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  trial: 'bg-sky-100 text-sky-700',
  suspended: 'bg-red-100 text-red-700',
  closed: 'bg-zinc-100 text-zinc-500',
}

const SUB_BADGE: Record<string, string> = {
  trial: 'bg-sky-100 text-sky-700',
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-red-100 text-red-700',
  expired: 'bg-red-100 text-red-700',
  cancelled: 'bg-zinc-100 text-zinc-500',
  past_due: 'bg-red-100 text-red-700',
}

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'closed', label: 'Closed' },
]

function buildHref(base: string, overrides: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  const merged = { ...overrides }
  Object.entries(merged).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v))
  })
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export default async function EnterprisesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>
}) {
  const sp = await searchParams
  const currentPage = Number(sp.page ?? 1)
  const currentStatus = sp.status ?? ''
  const currentSearch = sp.search ?? ''

  const result = await api.get<EnterprisesResponse>('/super-admin/enterprises', {
    page: currentPage,
    limit: 20,
    ...(currentStatus && { status: currentStatus }),
    ...(currentSearch && { search: currentSearch }),
  })

  const enterprises = result.data?.data ?? []
  const meta = result.data?.meta

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Businesses</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Manage all tenant businesses on the platform.
          </p>
        </div>
        <Link
          href="/super-admin/enterprises/new"
          className="flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800"
        >
          <Plus className="h-4 w-4" />
          New Business
        </Link>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Search */}
        <form
          method="GET"
          action="/super-admin/enterprises"
          className="relative w-full sm:max-w-xs"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            name="search"
            defaultValue={currentSearch}
            placeholder="Search businesses…"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-zinc-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {currentStatus && <input type="hidden" name="status" value={currentStatus} />}
        </form>

        {/* Status tabs */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={buildHref('/super-admin/enterprises', {
                status: tab.value || undefined,
                search: currentSearch || undefined,
              })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                currentStatus === tab.value
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Table card */}
      {enterprises.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white py-20 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <Building2 className="h-6 w-6 text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-500">No businesses found</p>
          <p className="mt-1 text-xs text-zinc-400">
            {currentSearch || currentStatus
              ? 'Try adjusting your filters.'
              : 'Get started by creating a new business.'}
          </p>
          {!currentSearch && !currentStatus && (
            <Link
              href="/super-admin/enterprises/new"
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-3.5 w-3.5" />
              New Business
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-800">
                  <th className="px-5 py-3.5">Business</th>
                  <th className="px-5 py-3.5">Industry</th>
                  <th className="px-5 py-3.5">Plan</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Users</th>
                  <th className="px-5 py-3.5">Modules</th>
                  <th className="px-5 py-3.5">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {enterprises.map((e) => (
                  <tr
                    key={e.id}
                    className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/super-admin/enterprises/${e.id}`}
                        className="block font-medium text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100"
                      >
                        {e.companyTradingName ?? e.companyLegalName}
                      </Link>
                      {e.companyTradingName && (
                        <p className="mt-0.5 text-xs text-zinc-400">{e.companyLegalName}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500 dark:text-zinc-400">{e.industry}</td>
                    <td className="px-5 py-3.5">
                      {e.activeSubscription ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${SUB_BADGE[e.activeSubscription.status] ?? 'bg-zinc-100 text-zinc-500'}`}
                        >
                          {e.activeSubscription.planCode}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[e.status] ?? 'bg-zinc-100 text-zinc-500'}`}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-zinc-500 dark:text-zinc-400">
                      {e._count?.users ?? 0}
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-zinc-500 dark:text-zinc-400">
                      {Array.isArray(e.businessSettings?.enabledModules)
                        ? e.businessSettings!.enabledModules!.length
                        : 0}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-zinc-400">
                      {new Date(e.createdAt).toLocaleDateString('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <p className="text-xs text-zinc-400">
                Page {meta.page} of {meta.totalPages}{' '}
                <span className="text-zinc-300 dark:text-zinc-600">·</span> {meta.total} total
              </p>
              <div className="flex gap-1.5">
                {meta.page > 1 ? (
                  <Link
                    href={buildHref('/super-admin/enterprises', {
                      page: meta.page - 1,
                      status: currentStatus || undefined,
                      search: currentSearch || undefined,
                    })}
                    className="flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </Link>
                ) : (
                  <span className="flex items-center gap-1 rounded-md border border-zinc-100 px-3 py-1.5 text-xs text-zinc-300 dark:border-zinc-800 dark:text-zinc-600">
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </span>
                )}
                {meta.page < meta.totalPages ? (
                  <Link
                    href={buildHref('/super-admin/enterprises', {
                      page: meta.page + 1,
                      status: currentStatus || undefined,
                      search: currentSearch || undefined,
                    })}
                    className="flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <span className="flex items-center gap-1 rounded-md border border-zinc-100 px-3 py-1.5 text-xs text-zinc-300 dark:border-zinc-800 dark:text-zinc-600">
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
