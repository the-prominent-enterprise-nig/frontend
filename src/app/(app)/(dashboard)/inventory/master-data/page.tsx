import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { MasterDataHub } from './_components/MasterDataHub'

export const metadata = {
  title: 'Master Data | NIG Central',
  description: 'Warehouses, suppliers, price lists, and inventory settings',
}

export default async function MasterDataPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <MasterDataHub session={session} />
    </Suspense>
  )
}
