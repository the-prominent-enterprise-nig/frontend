import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { getProcurementHubPermissions } from '../purchase-orders/_permissions/procurement-hub-permissions'
import { StockTransactionHub } from './_components/StockTransactionHub'

export const metadata = {
  title: 'Stock Transaction | NIG Central',
  description: 'Receiving, transfers, returns, adjustments, purchasing, and debit memos',
}

export default async function StockTransactionPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <StockTransactionHub session={session} procurement={getProcurementHubPermissions(session)} />
    </Suspense>
  )
}
