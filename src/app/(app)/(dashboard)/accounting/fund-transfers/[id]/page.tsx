import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { can } from '@/src/libs/guards/permission'
import FundTransferDetail from './_components/FundTransferDetail'

export const metadata = { title: 'Inter-Account Transfer' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = requirePermission(await getSessionOrNull(), [
    ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_READ,
    ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_TRANSFER,
  ])
  const { id } = await params
  return (
    <FundTransferDetail
      id={id}
      canEdit={can(session, ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_TRANSFER)}
    />
  )
}
