import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { HubTabs } from '../_shared/HubTabs'
import GeneralLedgerView from './_components/GeneralLedgerView'

export const metadata = {
  title: 'General Ledger | NIG Central',
  description: 'Every posted journal entry line, with running balances per account',
}

export default async function GeneralLedgerPage() {
  const session = requirePermission(
    await getSessionOrNull(),
    ACCOUNTING_PERMISSIONS.GENERAL_LEDGER_READ
  )
  return (
    <>
      <Suspense fallback={null}>
        <HubTabs hub="books" session={session} />
      </Suspense>
      <GeneralLedgerView />
    </>
  )
}
