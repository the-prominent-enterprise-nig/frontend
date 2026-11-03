import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { PriceListUploadPageView } from './_components/PriceListUploadPageView'

export const metadata = {
  title: 'Upload Prices | NIG Central',
  description: 'Add or update a price list’s items from a CSV file',
}

export default async function PriceListUploadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.PRICE_LISTS_UPDATE)) {
    redirect('/403')
  }

  const { id } = await params

  return (
    <div className="min-h-screen bg-[#fbfbfc]">
      <PriceListUploadPageView priceListId={id} />
    </div>
  )
}
