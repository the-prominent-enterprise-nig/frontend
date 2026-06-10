import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { CategoryManager } from './_components'

export const metadata = {
  title: 'Category Management | Prominent Enterprise',
  description: 'Organize inventory items into nested categories for easy navigation and reporting',
}

export default async function CategoriesPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.CATEGORIES_READ)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <CategoryManager session={session} />
    </div>
  )
}
