import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canAny } from '@/src/libs/guards/permission'
import { HubTabs } from '../_shared/HubTabs'
import SupplierDirectory from './_components/SupplierDirectory'
import { SUPPLIER_ACCESS } from '@/src/libs/guards/shared-ownership'

export const metadata = {
  title: 'Suppliers | NIG Central',
  description: 'Who you buy from, the terms you buy on, and the items they carry',
}

export default async function SuppliersPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!canAny(session, SUPPLIER_ACCESS.READ)) redirect('/403')

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <Suspense fallback={null}>
        <HubTabs hub="payables" session={session} />
      </Suspense>
      <SupplierDirectory session={session} />
    </div>
  )
}
