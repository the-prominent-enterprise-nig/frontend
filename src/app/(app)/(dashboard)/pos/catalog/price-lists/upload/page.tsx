import { redirect } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can } from '@/src/libs/guards/permission'
import { INVENTORY_PERMISSIONS } from '@/src/libs/guards/inventory-permissions'
import { AllListsUploadPageView } from '../_components/upload/AllListsUploadPageView'

export const metadata = {
  title: 'Bulk Upload Prices | NIG Central',
  description: 'Upload one CSV that updates the price list for every price use',
}

export default async function UploadPriceListPage() {
  const session = await getSessionOrNull()

  if (!session) {
    redirect('/login')
  }

  if (!can(session, INVENTORY_PERMISSIONS.PRICE_LISTS_UPDATE)) {
    redirect('/403')
  }

  return (
    <div className="min-h-screen bg-[#fbfbfc]">
      <AllListsUploadPageView />
    </div>
  )
}
