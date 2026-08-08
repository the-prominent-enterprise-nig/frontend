import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import ReportsHub from './_components/ReportsHub'

export const metadata = { title: 'Reports | Prominent Enterprise' }

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
