import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, isAdmin } from '@/src/libs/guards/permission'
import { getAuditLogs } from '../_actions/get-audit-logs'
import AuditLogsSection from '@/src/components/settings/AuditLogsSection'

export default async function AuditLogsPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  const canView = isAdmin(session) || can(session, 'admin:audit-logs:read')
  if (!canView) redirect('/403')

  const result = await getAuditLogs({ page: 1, limit: 20 })

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
        <AuditLogsSection initialData={result.data} />
      </div>
    </div>
  )
}
