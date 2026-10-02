import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { SettleClearingPage } from '../_components/BankReconFormPages'

export const metadata = { title: 'Settle Clearing Account' }
export default async function Page() {
  requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_RECONCILE)

  return <SettleClearingPage />
}
