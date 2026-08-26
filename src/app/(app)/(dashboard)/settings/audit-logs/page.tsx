import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, isAdmin } from '@/src/libs/guards/permission'
import { getAuditLogs } from '../_actions/get-audit-logs'
import { getBranches } from '../_actions/get-branches'
import { getAuditLogResourceTypes } from '../_actions/get-audit-log-resource-types'
import AuditLogsSection from '@/src/components/settings/AuditLogsSection'

export default async function AuditLogsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  const canView = isAdmin(session) || can(session, 'admin:audit-logs:read')
  if (!canView) redirect('/403')

  // Branch names for the Scope column, and the resource type list for the
  // filter dropdown — both best-effort, non-critical to the page's own
  // purpose, so a failure in either degrades gracefully (ScopeBadge's raw-ID
  // fallback; an empty, still-searchable-by-typing resource type list)
  // rather than blocking the audit log itself from loading.
  const [result, branchesResult, resourceTypesResult] = await Promise.all([
    getAuditLogs({ page: 1, limit: 10 }),
    getBranches(),
    getAuditLogResourceTypes(),
  ])
  const branches = branchesResult.success ? (branchesResult.data ?? []) : []
  const resourceTypes = resourceTypesResult.success ? (resourceTypesResult.data ?? []) : []

  if (!result.success || !result.data) {
    return (
      <div className="min-h-full bg-zinc-50 px-6 py-6">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-red-600">
              Failed to load audit logs: {result.error ?? 'Unknown error'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-semibold text-zinc-900">Audit Logs</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Full audit trail of actions performed in your workspace, with the scope active at the
            time of each action.
          </p>
        </div>
        <AuditLogsSection
          initialData={result.data}
          branches={branches}
          resourceTypes={resourceTypes}
        />
      </div>
    </div>
  )
}
