import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ReportsHub from '../accounting/reports/_components/ReportsHub'

export const metadata = { title: 'Reports | NIG Central' }

// Reports module — the financial reports hub, moved out of Accounting's nav
// into its own module beside Data Query Center. Same permission as before.
export default async function ReportsPage() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.FINANCIAL_REPORT_READ)
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense
        fallback={<div className="p-6 text-sm text-gray-400 animate-pulse">Loading reports…</div>}
      >
        <ReportsHub />
      </Suspense>
    </div>
  )
}
