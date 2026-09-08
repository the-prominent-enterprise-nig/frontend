import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import FundTransferForm from './_components/FundTransferForm'

export const metadata = { title: 'Fund Transfer' }
export default async function Page() {
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_TRANSFER)
  return <FundTransferForm />
}
