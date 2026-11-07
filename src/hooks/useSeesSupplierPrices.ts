import { useMe } from '@/src/hooks/useMe'
import { canSeeSupplierPrices } from '@/src/libs/guards/permission'

/** Whether the printable RR and PO show prices for the signed-in user:
 * roles that may see item cost only. False until the session loads. */
export function useSeesSupplierPrices(): boolean {
  const { data: me } = useMe()
  return !!me && canSeeSupplierPrices(me)
}
