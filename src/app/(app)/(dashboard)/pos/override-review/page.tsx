import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import OverrideReviewView from './_components/OverrideReviewView'

export const metadata = {
  title: 'Override Review | NIG Central',
  description: "The day's price overrides, typed terms and waivers, decided and signed off",
}

export default async function OverrideReviewPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  // Same gate as the other manager-side approvals (cancellations, refunds):
  // the Cashier who rang the sale cannot also be the one who reviews it.
  if (!can(session, POS_PERMISSIONS.TRANSACTIONS_OVERRIDE)) {
    redirect('/403')
  }

  return (
    <div className="min-h-full bg-zinc-50">
      <Suspense fallback={null}>
        <OverrideReviewView
          sessionBranchId={session.branchId ?? null}
          sessionBranchName={session.branchName ?? null}
        />
      </Suspense>
    </div>
  )
}
