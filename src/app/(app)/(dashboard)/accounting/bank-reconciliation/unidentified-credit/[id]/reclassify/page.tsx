import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { ReclassifyPage } from '../../../_components/BankReconFormPages'

export const metadata = { title: 'Reclassify Credit' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.BANK_ACCOUNTS_RECONCILE)
  const { id } = await params
  return <ReclassifyPage id={id} />
}
