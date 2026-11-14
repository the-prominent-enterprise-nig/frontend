import { Suspense } from 'react'
import type { JSX } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { HubTabs } from '../../_shared/HubTabs'
import AccountTransactions from './_components/AccountTransactions'

export const metadata = { title: 'Account Transactions' }

// The balance drill-down on Bank and Cash Accounts. Same guard as the list:
// the server keeps a Branch Cashier to their own branch's petty cash fund.
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<JSX.Element> {
  const session = requirePermission(await getSessionOrNull(), [
    ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_READ,
    ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_READ_BRANCH_FUND,
  ])
  const { id } = await params
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={null}>
        <HubTabs hub="cash-banking" session={session} />
      </Suspense>
      <AccountTransactions id={id} />
    </div>
  )
}
