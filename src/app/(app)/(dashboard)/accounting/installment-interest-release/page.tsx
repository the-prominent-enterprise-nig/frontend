import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import InstallmentInterestReleaseView from './_components/InstallmentInterestReleaseView'

export const metadata = {
  title: 'Installment Interest Release | Prominent Enterprise',
}

export default async function InstallmentInterestReleasePage() {
  const session = await getSessionOrNull()
  const user = requirePermission(session, ACCOUNTING_PERMISSIONS.INSTALLMENT_INTEREST_RELEASE)

  return (
    <div className="min-h-screen bg-gray-50">
      <InstallmentInterestReleaseView session={user} />
    </div>
  )
}
