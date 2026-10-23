import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { UnidentifiedCreditPage } from '../_components/BankReconFormPages'

export const metadata = { title: 'Record Unidentified Bank Credit' }
export default async function Page() {
  requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_RECONCILE)

  return <UnidentifiedCreditPage />
}
