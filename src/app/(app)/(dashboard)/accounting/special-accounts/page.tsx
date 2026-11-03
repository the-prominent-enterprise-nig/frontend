import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { HubTabs } from '../_shared/HubTabs'
import SpecialAccountsList from './_components/SpecialAccountsList'

export const metadata = {
  title: 'Special Accounts | NIG Central',
}

export default async function SpecialAccountsPage() {
  const session = requirePermission(
    await getSessionOrNull(),
    ACCOUNTING_PERMISSIONS.SPECIAL_ACCOUNTS_READ
  )

  return (
    <>
      <Suspense fallback={null}>
        <HubTabs hub="expenses" session={session} />
      </Suspense>
      <SpecialAccountsList />
    </>
  )
}
