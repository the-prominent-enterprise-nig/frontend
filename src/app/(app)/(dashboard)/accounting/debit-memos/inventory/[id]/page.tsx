import { notFound } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { getInventoryDebitMemo } from '../_actions/inventory-debit-memos'
import IdmEditor from '../_components/IdmEditor'

export const metadata = { title: 'Debit Memo' }

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<React.JSX.Element> {
  const session = requirePermission(
    await getSessionOrNull(),
    ACCOUNTING_PERMISSIONS.INVENTORY_DEBIT_MEMOS_READ
  )
  const { id } = await params
  const res = await getInventoryDebitMemo(id)
  if (!res.success || !res.data) notFound()
  return (
    <IdmEditor
      memo={res.data}
      permissions={{
        canEdit: can(session, ACCOUNTING_PERMISSIONS.INVENTORY_DEBIT_MEMOS_UPDATE),
        canPost: can(session, ACCOUNTING_PERMISSIONS.INVENTORY_DEBIT_MEMOS_APPROVE),
        canVoid: can(session, ACCOUNTING_PERMISSIONS.INVENTORY_DEBIT_MEMOS_VOID),
      }}
    />
  )
}
