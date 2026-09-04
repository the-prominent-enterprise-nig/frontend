import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { DebitMemosHub } from './_components/DebitMemosHub'

export const metadata = {
  title: 'Debit Memos | Prominent Enterprise',
  description: 'Customer debit memos and supplier returns in one place',
}

export default async function DebitMemosPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  // Either one is enough to reach the hub — it filters its own tabs down to
  // whichever the caller can actually see.
  const hasAccess = canAny(session, [
    ACCOUNTING_PERMISSIONS.DEBIT_MEMOS_READ,
    ACCOUNTING_PERMISSIONS.SUPPLIER_DEBIT_MEMOS_READ,
  ])

  if (!hasAccess) redirect('/403')

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <DebitMemosHub session={session} />
    </Suspense>
  )
}
