import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { HubTabs } from '../_shared/HubTabs'
import SpecialAccountsList from './_components/SpecialAccountsList'

export const metadata = {
  title: 'Special Accounts | NIG Central',
}

export default async function SpecialAccountsPage() {
  const session = await getSessionOrNull()
  if (!session) redirect('/login')

  return (
    <>
      <Suspense fallback={null}>
        <HubTabs hub="expenses" session={session} />
      </Suspense>
      <SpecialAccountsList />
    </>
  )
}
