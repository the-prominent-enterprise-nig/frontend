import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import SalesReportsView from './_components/SalesReportsView'

export const metadata = {
  title: 'Sales Reports | NIG Central',
  description: 'Units and sales by model and brand, month by month',
}

export default async function PosReportsPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  // Branch staff hold this too (NIG UAT 2026-11-09): the API holds a
  // branch-tied user to their own branch and drops unit cost. Business Owner
  // is covered by the enterprise-owner bypass inside can().
  if (!can(session, POS_PERMISSIONS.REPORTS_READ)) {
    redirect('/403')
  }

  // Suspense: the view reads its tab and filters from the URL (useSearchParams).
  return (
    <div className="min-h-screen bg-zinc-50">
      <Suspense>
        <SalesReportsView />
      </Suspense>
    </div>
  )
}
