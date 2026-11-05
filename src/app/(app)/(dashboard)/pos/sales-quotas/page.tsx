import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { canManageSalesQuotas } from '@/src/libs/guards/permission'
import SalesQuotasView from './_components/SalesQuotasView'

export const metadata = {
  title: 'Sales Quotas | NIG Central',
  description: 'Monthly sales targets for each branch and the AC Unit + Services line',
}

export default async function SalesQuotasPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  // Business Owner only — a Branch Manager's pos:*:* wildcard must not reach
  // this (canManageSalesQuotas).
  if (!canManageSalesQuotas(session)) redirect('/403')

  return (
    <div className="min-h-screen bg-zinc-50">
      <SalesQuotasView />
    </div>
  )
}
