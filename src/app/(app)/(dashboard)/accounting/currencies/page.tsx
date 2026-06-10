import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { ACCOUNTING_PERMISSIONS } from '@/src/libs/guards/accounting-permissions'
import { CurrenciesList } from './_components/CurrenciesList'

export const metadata = {
  title: 'Currencies | Prominent Enterprise',
  description: 'Manage currencies and exchange rates',
}

export default async function CurrenciesPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')
  if (!can(session, ACCOUNTING_PERMISSIONS.CURRENCY_READ)) redirect('/403')

  return <CurrenciesList session={session} />
}
