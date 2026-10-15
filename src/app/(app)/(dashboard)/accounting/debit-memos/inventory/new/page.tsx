import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import IdmEditor from '../_components/IdmEditor'

export const metadata = { title: 'New Debit Memo' }

/** A standalone DMINV memo — no delivery receipt, journal entry only. */
export default async function Page(): Promise<React.JSX.Element> {
  requirePermission(await getSessionOrNull(), ACCOUNTING_PERMISSIONS.INVENTORY_DEBIT_MEMOS_CREATE)
  return <IdmEditor memo={null} permissions={{ canEdit: true, canPost: false, canVoid: false }} />
}
