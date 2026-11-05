import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import PriceOverrideLogView from './_components/PriceOverrideLogView'

export const metadata = {
  title: 'Price Override Log | NIG Central',
  description:
    'Every price override, typed installment term and waived credit application, by branch and day',
}

export default async function OverrideReviewPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  // Same gate as the manager-side pages (cancellations, refunds): a Cashier does
  // not read the log of what the floor, themselves included, took. Head Office
  // roles with all of POS (Sales Admin) hold it through the wildcard.
  if (!can(session, POS_PERMISSIONS.TRANSACTIONS_OVERRIDE)) {
    redirect('/403')
  }

  return (
    <div className="min-h-full bg-zinc-50">
      <Suspense fallback={null}>
        <PriceOverrideLogView
          sessionBranchId={session.branchId ?? null}
          sessionBranchName={session.branchName ?? null}
        />
      </Suspense>
    </div>
  )
}
