import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { CatalogHub } from './_components/CatalogHub'

export const metadata = {
  title: 'Catalog | Prominent Enterprise',
  description: 'Manage items, categories, attributes, units of measure, and barcodes',
}

export default async function CatalogPage() {
  const session = await getSessionOrNull()

  if (!session) redirect('/login')
  if (!can(session, INVENTORY_PERMISSIONS.ITEMS_READ)) redirect('/403')

  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <CatalogHub session={session} />
    </Suspense>
  )
}
