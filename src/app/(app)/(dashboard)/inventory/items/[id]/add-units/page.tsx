import { notFound } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { getItem } from '../../_actions/get-item'
import AddUnitsForm from '../../_components/AddUnitsForm'

export const metadata = { title: 'Add units | NIG Central' }

/** Item Master → Add units, and where Add Item's Create lands (`?new=1`). */
export default async function AddUnitsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ new?: string }>
}): Promise<React.JSX.Element> {
  requirePermission(await getSessionOrNull(), [INVENTORY_PERMISSIONS.ITEMS_CREATE])
  const [{ id }, query] = await Promise.all([params, searchParams])
  const res = await getItem(id)
  if (!res.success || !res.data) notFound()
  return (
    <div className="flex min-h-screen flex-col">
      <AddUnitsForm item={res.data} isNewItem={query.new === '1'} />
    </div>
  )
}
