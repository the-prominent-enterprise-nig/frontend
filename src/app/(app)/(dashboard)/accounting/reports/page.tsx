import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ReportsHub from './_components/ReportsHub'

export const metadata = { title: 'Reports | NIG Central' }

export default async function ReportsPage() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense
        fallback={<div className="p-6 text-sm text-gray-400 animate-pulse">Loading reports…</div>}
      >
        {/* A branch-assigned user's reports are their branch's. The server
            enforces it; the hub shows it instead of an "All Branches" picker. */}
        <ReportsHub
          ownBranch={
            session?.branchId
              ? { id: session.branchId, name: session.branchName ?? 'Your branch' }
              : null
          }
        />
      </Suspense>
    </div>
  )
}
