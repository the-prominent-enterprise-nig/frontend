import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { can } from '@/src/libs/guards/permission'
import FundTransfersList from './_components/FundTransfersList'

export const metadata = { title: 'Inter-Account Transfers' }
export default async function Page() {
  const session = requirePermission(await getSessionOrNull(), [
    ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_READ,
    ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_TRANSFER,
  ])
  return (
    <FundTransfersList canCreate={can(session, ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_TRANSFER)} />
  )
}
