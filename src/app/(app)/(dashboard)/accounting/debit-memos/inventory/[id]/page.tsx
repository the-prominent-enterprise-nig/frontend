import { notFound } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { canAny } from '@/src/libs/guards/permission'
import { getInventoryDebitMemo } from '../_actions/inventory-debit-memos'
import IdmEditor from '../_components/IdmEditor'
import { INVENTORY_DEBIT_MEMO_ACCESS } from '@/src/libs/guards/shared-ownership'

export const metadata = { title: 'Debit Memo' }

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<React.JSX.Element> {
  const session = requirePermission(await getSessionOrNull(), INVENTORY_DEBIT_MEMO_ACCESS.READ)
  const { id } = await params
  const res = await getInventoryDebitMemo(id)
  if (!res.success || !res.data) notFound()
  return (
    <IdmEditor
      memo={res.data}
      permissions={{
        canEdit: canAny(session, INVENTORY_DEBIT_MEMO_ACCESS.UPDATE),
        canPost: canAny(session, INVENTORY_DEBIT_MEMO_ACCESS.APPROVE),
        canVoid: canAny(session, INVENTORY_DEBIT_MEMO_ACCESS.VOID),
      }}
    />
  )
}
