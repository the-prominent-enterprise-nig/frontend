import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import DebitMemoList from './_components/DebitMemoList'

export const metadata = {
  title: 'Debit Memos | Prominent Enterprise',
  description:
    'Raise and approve returns of defective stock to suppliers, deducted from their open invoices',
}

export default async function DebitMemosPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.SUPPLIER_RETURNS_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <DebitMemoList session={session} />
    </div>
  )
}
