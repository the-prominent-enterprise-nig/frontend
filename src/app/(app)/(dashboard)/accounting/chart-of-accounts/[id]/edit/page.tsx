import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import AccountForm from '../../_components/AccountForm'

export const metadata = { title: 'Edit Account | NIG Central' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSessionOrNull()
  requirePermission(session, ACCOUNTING_PERMISSIONS.ACCOUNT_UPDATE)
  return <AccountForm accountId={id} />
}
