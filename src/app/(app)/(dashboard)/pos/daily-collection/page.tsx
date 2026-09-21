import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import DailyCollectionView from './_components/DailyCollectionView'

export const metadata = {
  title: 'Daily Collection Report | Prominent Enterprise',
  description: "A branch's collections for one business day, with denomination count",
}

export default async function DailyCollectionPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  // Not pos:reports:read — that tier exposes unit cost and margin and is
  // withheld from Cashier. This report exposes neither, and the cashier
  // closing the shift is the person who prints and signs it.
  if (!can(session, POS_PERMISSIONS.DAILY_COLLECTION_READ)) {
    redirect('/403')
  }

  // The form's letterhead is the enterprise's own trading name, not the app's
  // — a branch files this printout in the same binder as the paper original.
  const companyName =
    session.enterpriseOwner?.companyTradingName ?? session.enterpriseOwnerName ?? ''

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* The view reads ?date / ?branchId so POS can link straight to one
          report; useSearchParams needs a boundary to render behind. */}
      <Suspense fallback={null}>
        {/* A branch-assigned user has one form, not a network: the API forces
            their branch whatever is asked for, so the screen has to agree with
            it rather than offering a roll-up it cannot fill. */}
        <DailyCollectionView
          companyName={companyName}
          preparedBy={session.fullName ?? session.email ?? ''}
          canEdit={can(session, POS_PERMISSIONS.DAILY_COLLECTION_UPDATE)}
          sessionBranchId={session.branchId ?? null}
          sessionBranchName={session.branchName ?? null}
        />
      </Suspense>
    </div>
  )
}
