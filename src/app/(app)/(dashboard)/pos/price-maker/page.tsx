import { getSessionOrNull } from '@/src/libs/auth/actions'
import { requirePermission } from '@/src/libs/guards/require-permission'
import { POS_PERMISSIONS } from '@/src/libs/guards/pos-permissions'
import { PriceMakerView } from './_components/PriceMakerView'

export const metadata = { title: 'Price Maker | NIG Central' }

export default async function PriceMakerPage() {
  // A quoting tool for whoever is selling — the same gate as the rest of the
  // sales counter, and the same one the endpoint holds.
  requirePermission(await getSessionOrNull(), POS_PERMISSIONS.TRANSACTIONS_READ)
  return <PriceMakerView />
}
