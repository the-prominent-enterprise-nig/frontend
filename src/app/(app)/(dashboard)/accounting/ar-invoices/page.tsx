import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { HubTabs } from '../_shared/HubTabs'
import ARInvoicesList from './_components/ARInvoicesList'

export const metadata = { title: 'AR Invoices' }
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>
}) {
  const session = requirePermission(
    await getSessionOrNull(),
    ACCOUNTING_PERMISSIONS.AR_INVOICES_READ
  )
  const { customerId } = await searchParams
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={null}>
        <HubTabs hub="receivables" session={session} />
      </Suspense>
      <ARInvoicesList initialCustomerId={customerId} />
    </div>
  )
}
